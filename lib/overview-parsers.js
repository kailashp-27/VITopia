import { load } from "cheerio";
import { AppError } from "./errors.js";
const clean = (s) => s.replace(/\s+/g, " ").trim();
const cells = ($, row) => $(row).children("th,td").toArray();
const rows = (table) =>
  table
    .children("tr")
    .add(table.children("thead,tbody,tfoot").children("tr"))
    .toArray();
const courseCode = /\b[A-Z]{3,5}\d{3,4}[A-Z]?\b/;
const weekday =
  /^(MON|TUE|WED|THU|FRI|SAT|SUN)(?:DAY|SDAY|NESDAY|RSDAY|URDAY)?$/i;
const dayName = (s) => (weekday.test(s) ? s.slice(0, 3).toUpperCase() : null);
export function clockMinutes(text) {
  const m = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(clean(text));
  if (!m) return null;
  let h = Number(m[1]);
  const minute = Number(m[2]);
  if (minute > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) return null;
  if (m[3]) h = (h % 12) + (/PM/i.test(m[3]) ? 12 : 0);
  return h * 60 + minute;
}
export function parseRegisteredCourses(html) {
  const $ = load(html),
    courses = new Map();
  $("#studentDetailsList table")
    .first()
    .each((_, table) => {
      const rs = rows($(table));
      const header = rs.findIndex((r) =>
        cells($, r).some((c) =>
          /^course$|course (title|name)/i.test(clean($(c).text())),
        ),
      );
      if (header < 0) return;
      const headings = cells($, rs[header]).map((c) =>
        clean($(c).text()).toLowerCase(),
      );
      const ci = headings.findIndex((h) =>
        /^course$|course (title|name)/.test(h),
      );
      const cr = headings.findIndex((h) =>
        /credit|l\s*t\s*p\s*j\s*c|^c$/.test(h),
      );
      const sl = headings.findIndex((h) => h.includes("slot"));
      const fa = headings.findIndex((h) => h.includes("faculty"));
      for (const row of rs.slice(header + 1)) {
        const value = cells($, row).map((c) => clean($(c).text()));
        const code = value.join(" ").match(courseCode)?.[0];
        if (!code) continue;
        const raw = value[ci] || "";
        const creditText = value[cr]?.trim().split(/\s+/).at(-1) || "";
        const credits =
          /^\d+(?:\.\d+)?$/.test(creditText) && Number(creditText) <= 40
            ? Number(creditText)
            : null;
        const type = raw.match(/\(([^)]+)\)\s*$/)?.[1] || "";
        const slotVenue = (value[sl] || "").split(/\s*-\s*/);
        courses.set(code, {
          code,
          title: raw
            .replace(courseCode, "")
            .replace(/^\s*-\s*/, "")
            .replace(/\s*\([^)]*\)\s*$/, "")
            .trim(),
          type,
          credits,
          slot: slotVenue[0] || "",
          venue: slotVenue.slice(1).join("-"),
          faculty: value[fa] || "",
        });
      }
    });
  return [...courses.values()];
}
export function parseStudentIdentity(html) {
  const $ = load(html);
  const profile = {};
  $("tr").each((_, row) => {
    const values = cells($, row).map((c) => clean($(c).text()));
    for (let i = 0; i < values.length - 1; i++) {
      const label = values[i].replace(/[:.]/g, "").trim();
      if (/^(?:student )?name$/i.test(label) && !profile.name)
        profile.name = values[i + 1];
      if (
        /^(?:register|registration|reg)\s*(?:number|no)$/i.test(label) &&
        !profile.registration
      )
        profile.registration = values[i + 1];
    }
  });
  return profile;
}
const clock = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

// Expand table spans so course cells stay aligned with their start/end headers.
function matrix($, table) {
  const grid = [];
  rows(table).forEach((row, i) => {
    grid[i] ||= [];
    let col = 0;
    for (const cell of cells($, row)) {
      while (grid[i][col] !== undefined) col++;
      const text = clean($(cell).text());
      const height = Math.min(
        14,
        Math.max(1, Number($(cell).attr("rowspan")) || 1),
      );
      const width = Math.min(
        36,
        Math.max(1, Number($(cell).attr("colspan")) || 1),
      );
      for (let r = i; r < i + height; r++) {
        grid[r] ||= [];
        for (let c = col; c < col + width; c++) grid[r][c] = text;
      }
      col += width;
    }
  });
  return grid;
}
export function parseTimetable(html) {
  const $ = load(html);
  const metadata = new Map();
  $("#studentDetailsList table")
    .first()
    .each((_, table) => {
      const rs = rows($(table));
      const headers = cells($, rs[0]).map((c) =>
        clean($(c).text()).toLowerCase(),
      );
      const courseIdx = headers.findIndex(
        (h) => h === "course" || /course (title|name)/.test(h),
      );
      const facultyIdx = headers.findIndex((h) => h.includes("faculty"));
      for (const row of rs.slice(1)) {
        const values = cells($, row).map((c) => clean($(c).text()));
        const raw = values[courseIdx] || "";
        const code = values.join(" ").match(courseCode)?.[0];
        if (code)
          metadata.set(code, {
            title: raw
              .replace(courseCode, "")
              .replace(/^\s*-\s*/, "")
              .replace(/\s*\([^)]*\)\s*$/, "")
              .trim(),
            faculty: values[facultyIdx] || "",
          });
      }
    });
  let grid;
  for (const table of $("table").toArray()) {
    const candidate = matrix($, $(table));
    if (candidate.some((row) => dayName(row[0] || ""))) {
      grid = candidate;
      break;
    }
  }
  if (!grid)
    throw new AppError(
      "TIMETABLE_UNAVAILABLE",
      "VTOP did not return a weekly timetable.",
      502,
    );
  const times = { THEORY: { start: [], end: [] }, LAB: { start: [], end: [] } };
  let headerType;
  for (const row of grid) {
    const type = row[0]?.toUpperCase();
    if (type === "THEORY" || type === "LAB") headerType = type;
    const marker = row.findIndex((text) => /^(start|end)$/i.test(text));
    if (marker >= 0 && headerType && !dayName(row[0] || "")) {
      const key = row[marker].toLowerCase();
      // Rowspan expansion retains two label columns on both header rows.
      times[headerType][key] = row.slice(marker + 1);
    }
  }
  const sessions = [];
  let currentDay;
  let occupied = 0;
  let invalidTiming = false;
  for (const row of grid) {
    const day = dayName(row[0] || "");
    if (day) currentDay = day;
    else if (!/^LAB$/i.test(row[0] || "")) continue;
    if (!currentDay) continue;
    const typeIndex = row.findIndex((s) => /^(THEORY|LAB)$/i.test(s));
    if (typeIndex < 0) continue;
    const type = row[typeIndex].toUpperCase();
    for (let col = typeIndex + 1; col < row.length; col++) {
      const text = row[col];
      const code = text?.match(courseCode)?.[0];
      if (!code) continue;
      occupied++;
      const offset = col - typeIndex - 1;
      const start = clockMinutes(times[type].start[offset] || "");
      const end = clockMinutes(times[type].end[offset] || "");
      if (start === null || end === null || end <= start) {
        invalidTiming = true;
        continue;
      }
      const suffix = text
        .slice(text.indexOf(code) + code.length)
        .replace(/^-/, "")
        .split("-");
      const venue = suffix.length >= 3 ? suffix.slice(1, -1).join("-") : "";
      const meta = metadata.get(code);
      const item = {
        day: currentDay,
        code,
        title: meta?.title || code,
        faculty: meta?.faculty || "",
        type: type === "LAB" ? "Lab" : "Theory",
        slot: text.split("-")[0],
        venue,
        start: clock(start),
        end: clock(end),
        periods: 1,
      };
      if (
        !sessions.some(
          (s) =>
            s.day === item.day &&
            s.code === code &&
            s.type === item.type &&
            s.start === item.start,
        )
      )
        sessions.push(item);
    }
  }
  if (invalidTiming || (occupied && !sessions.length))
    throw new AppError(
      "TIMETABLE_UNAVAILABLE",
      "VTOP's timetable times could not be read.",
      502,
    );
  // Consecutive lab periods form one block on the daily screen.
  sessions.sort(
    (a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start),
  );
  const merged = [];
  for (const item of sessions) {
    const previous = merged.at(-1);
    const gap = previous
      ? clockMinutes(item.start) - clockMinutes(previous.end)
      : -1;
    if (
      previous &&
      item.day === previous.day &&
      item.type === "Lab" &&
      previous.type === "Lab" &&
      item.code === previous.code &&
      item.venue === previous.venue &&
      gap >= 0 &&
      gap <= 15
    ) {
      previous.end = item.end;
      previous.slot += `+${item.slot}`;
      previous.periods += item.periods;
    } else merged.push({ ...item });
  }
  return { available: true, classes: merged };
}
export function parseODReferences(html) {
  const $ = load(html),
    found = new Map();
  $("[onclick*='processViewAttendanceDetail']").each((_, el) => {
    const match =
      /processViewAttendanceDetail\(\s*['"]([A-Z0-9_+/.=-]{1,256})['"]\s*,\s*['"]([A-Z0-9+_ -]{1,120})['"]/i.exec(
        $(el).attr("onclick") || "",
      );
    if (!match) return;
    const row = $(el).closest("tr");
    const code =
      cells($, row)
        .map((c) => clean($(c).text()))
        .join(" ")
        .match(courseCode)?.[0] || "";
    found.set(`${match[1]}:${match[2]}`, {
      classId: match[1],
      slot: match[2],
      code,
    });
  });
  return [...found.values()];
}
export function parseODDetails(html) {
  const $ = load(html);
  for (const table of $("table").toArray()) {
    const rs = rows($(table));
    for (let i = 0; i < rs.length; i++) {
      const headers = cells($, rs[i]).map((c) =>
        clean($(c).text()).toLowerCase(),
      );
      const statusIdx = headers.findIndex((h) =>
        /(?:attendance )?status/.test(h),
      );
      if (statusIdx < 0) continue;
      const timingIdx = headers.findIndex((h) => /timing|time/.test(h));
      const periodsIdx = headers.findIndex((h) =>
        /^(?:no\.? of )?(?:periods|hours)$/.test(h),
      );
      let entries = 0,
        recorded = 0,
        hours = 0,
        missingTiming = false;
      for (const row of rs.slice(i + 1)) {
        const values = cells($, row).map((c) => clean($(c).text()));
        const status = values[statusIdx] || "";
        if (/^(?:on[ -]?duty|od)(?:\s*\([^)]*\))?$/i.test(status)) {
          entries++;
          recorded++;
          const explicit = values[periodsIdx] || "";
          const times =
            (values[timingIdx] || "").match(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi) ||
            [];
          if (/^\d+(?:\.\d+)?$/.test(explicit) && Number(explicit) > 0)
            hours += Number(explicit);
          else if (times.length >= 2) {
            const start = clockMinutes(times[0]),
              end = clockMinutes(times.at(-1));
            let duration = start === null || end === null ? 0 : end - start;
            if (duration < 0 && !/AM|PM/i.test(times.join(" ")))
              duration += 720;
            if (duration > 0 && duration <= 480)
              hours += Math.max(1, Math.round(duration / 50));
            else missingTiming = true;
          } else missingTiming = true;
        } else if (/^(?:present|absent|p|a)$/i.test(status)) recorded++;
        else if (
          status &&
          values.length > statusIdx &&
          !/^(?:cancelled|canceled|not conducted)$/i.test(status)
        )
          throw new AppError(
            "OD_UNAVAILABLE",
            "VTOP returned an unrecognized attendance status.",
            502,
          );
      }
      if (
        !recorded &&
        !/no (?:attendance |class )?(?:records?|data)|no classes/i.test(
          $(table).text(),
        )
      )
        throw new AppError(
          "OD_UNAVAILABLE",
          "VTOP attendance details were empty or unrecognized.",
          502,
        );
      return { entries, recorded, hours: missingTiming ? null : hours };
    }
  }
  throw new AppError(
    "OD_UNAVAILABLE",
    "VTOP did not return attendance detail statuses.",
    502,
  );
}

// Navigation pages only. Never follow feedback submit/save/process actions.
export function feedbackPagePath(html) {
  const $ = load(html);
  for (const el of $("a,button[data-url]").toArray()) {
    const node = $(el);
    if (!/course feedback|student feedback/i.test(node.text())) continue;
    const raw = node.attr("data-url") || node.attr("href") || "";
    const path = raw.replace(/^\/vtop\//, "");
    if (
      /^(?:academics\/common|feedback)\/[a-zA-Z]*Feedback[a-zA-Z]*$/.test(
        path,
      ) &&
      !/save|submit|delete|process|post/i.test(path)
    )
      return path;
  }
  return null;
}
export function parseFeedbackStatus(
  html,
  semesterId,
  requestedSemester = false,
) {
  const $ = load(html);
  const text = clean($("body").text());
  if (
    /feedback (?:is )?(?:not (?:yet )?open|closed|not enabled|not available)/i.test(
      text,
    )
  )
    return { available: true, status: "not-open" };
  const selected = $(
    "select[name='semesterSubId'] option:selected,select#semesterSubId option:selected,input[name='semesterSubId']",
  ).first();
  const selectedId = selected.attr("value");
  if (
    (selectedId && selectedId !== semesterId) ||
    (!selectedId && !requestedSemester)
  )
    return { available: false, status: "unavailable" };
  const given = (value) =>
    /not\s*(?:yet\s*)?given|not\s*submitted|pending|yet to/i.test(value)
      ? "not-given"
      : /\bgiven\b|submitted|completed/i.test(value)
        ? "given"
        : "unknown";
  const statuses = [];
  $("table").each((_, table) => {
    for (const row of rows($(table))) {
      const value = cells($, row).map((c) => clean($(c).text()));
      const type = value[0]?.replace(/feed\s*back/gi, "feedback") || "";
      if (
        value.length < 3 ||
        !/^(?:curriculum|course) feedback status/i.test(type)
      )
        continue;
      statuses.push({
        type: /^curriculum/i.test(type) ? "Curriculum" : "Course",
        mid: given(value[1]),
        tee: given(value[2]),
      });
    }
  });
  if (statuses.length) {
    const values = statuses.flatMap((row) => [row.mid, row.tee]);
    return {
      available: true,
      semesterId,
      rows: statuses,
      status: values.includes("not-given")
        ? "pending"
        : values.includes("unknown")
          ? "unknown"
          : "submitted",
      submitted: values.filter((v) => v === "given").length,
      total: values.length,
    };
  }
  let submitted = 0,
    pending = 0,
    unknown = 0;
  $("table").each((_, table) => {
    const rs = rows($(table));
    const header = rs.findIndex(
      (r) => /status/i.test($(r).text()) && /course/i.test($(r).text()),
    );
    if (header < 0) return;
    const index = cells($, rs[header]).findIndex((c) =>
      /status/i.test($(c).text()),
    );
    for (const row of rs.slice(header + 1)) {
      const value = cells($, row).map((c) => clean($(c).text()));
      if (!courseCode.test(value.join(" "))) continue;
      const status = value[index] || "";
      if (
        /^(?:not submitted|pending|yet to submit|not completed)$/i.test(status)
      )
        pending++;
      else if (/^(?:submitted|completed|done)$/i.test(status)) submitted++;
      else unknown++;
    }
  });
  if (unknown || (!submitted && !pending))
    return { available: false, status: "unavailable" };
  return {
    available: true,
    status: pending ? "pending" : "submitted",
    submitted,
    total: submitted + pending,
  };
}

export function parseExamSchedule(html) {
  const $ = load(html),
    exams = [];
  let recognized = false;
  $("table").each((_, table) => {
    let indexes = null,
      examType = "";
    for (const row of rows($(table))) {
      const nodes = cells($, row),
        value = nodes.map((c) => clean($(c).text()));
      const headings = value.map((v) => v.toLowerCase());
      const date = headings.findIndex((v) => /date/.test(v));
      const time = headings.findIndex((v) => /time|timing/.test(v));
      if (date >= 0 && time >= 0) {
        recognized = true;
        indexes = {
          date,
          time,
          slot: headings.findIndex((v) => /slot/.test(v)),
          code: headings.findIndex((v) => /course.*code/.test(v)),
          title: headings.findIndex((v) => /course.*(?:title|name)/.test(v)),
          venue: headings.findIndex((v) => /venue/.test(v)),
          location: headings.findIndex((v) => /location|room/.test(v)),
          seat: headings.findIndex((v) => /seat.*(?:no|number)/.test(v)),
          type: headings.findIndex((v) => /exam.*type/.test(v)),
        };
        continue;
      }
      if (nodes.length === 1 && Number($(nodes[0]).attr("colspan")) > 1) {
        examType = value[0];
        continue;
      }
      if (!indexes || !value[indexes.date] || !/\d/.test(value[indexes.date]))
        continue;
      const get = (key) => value[indexes[key]] || "";
      exams.push({
        examType: get("type") || examType || "Exam",
        date: get("date"),
        time: get("time"),
        slot: get("slot"),
        code: get("code"),
        title: get("title"),
        venue: get("venue"),
        location: get("location"),
        seat: get("seat"),
      });
    }
  });
  if (
    !recognized &&
    !/no (?:exam |schedule |data |records)|not (?:found|published|released)|schedule.*not available/i.test(
      $("body").text(),
    )
  )
    throw new AppError(
      "EXAMS_UNAVAILABLE",
      "VTOP did not return a recognized exam schedule.",
      502,
    );
  return { available: true, items: exams };
}
