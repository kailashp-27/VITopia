import {
  clockToMinutes,
  istMinutesNow,
  scheduleForDate,
  shiftDate,
} from "./schedule.js";
import { todayISO } from "./calendar-utils.js";
import { attendanceUnits } from "./simulator.js";

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const normalizeCode = (c) => String(c || "").toUpperCase().replace(/\s+/g, "");
const normalizeSlot = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");

export function parseVtopDateMs(value) {
  if (!value) return null;
  const text = String(value).trim();
  const dmyWord = /^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})$/.exec(text);
  if (dmyWord) {
    const day = Number(dmyWord[1]);
    const month = MONTHS[dmyWord[2].slice(0, 3).toLowerCase()];
    const year = Number(dmyWord[3]);
    if (month !== undefined) return Date.UTC(year, month, day);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmyNum = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (dmyNum)
    return Date.UTC(Number(dmyNum[3]), Number(dmyNum[2]) - 1, Number(dmyNum[1]));
  return null;
}

export function findCourseHistory(course, attendanceHistory) {
  if (!course || !attendanceHistory?.byCourse) return null;
  const byCourse = attendanceHistory.byCourse;
  const code = normalizeCode(course.code);
  const slot = normalizeSlot(course.slot);

  const exactKey = `${code}::${slot}`;
  if (byCourse[exactKey]) return byCourse[exactKey];

  const entries = Object.values(byCourse);
  if (slot) {
    const bySlot = entries.find(
      (e) => normalizeCode(e.code) === code && normalizeSlot(e.slot) === slot,
    );
    if (bySlot) return bySlot;
  }

  const sameCode = entries.filter((e) => normalizeCode(e.code) === code);
  if (sameCode.length === 1) return sameCode[0];

  if (sameCode.length > 1) {
    const courseIsLab = /lab/i.test(course.type || "");
    const match = sameCode.find(
      (e) => /^L\d/i.test(normalizeSlot(e.slot)) === courseIsLab,
    );
    if (match) return match;
  }

  return null;
}

export function sortRecordsNewestFirst(records = []) {
  return records
    .map((record, index) => ({
      record,
      index,
      ts: parseVtopDateMs(record.date),
    }))
    .sort((a, b) => {
      if (a.ts !== null && b.ts !== null && a.ts !== b.ts) {
        return b.ts - a.ts;
      }
      return b.index - a.index;
    })
    .map((item) => item.record);
}

export function summarizeAttendanceRecords(records = []) {
  let present = 0;
  let absent = 0;
  let od = 0;
  for (const r of records) {
    if (r.kind === "present") present++;
    else if (r.kind === "absent") absent++;
    else if (r.kind === "od") od++;
  }
  return { present, absent, od, total: records.length };
}

export function collectOdItems(data) {
  const titleMap = new Map();
  for (const c of data?.attendance || []) {
    if (c?.code && c?.title) titleMap.set(normalizeCode(c.code), c.title);
  }
  for (const c of data?.overview?.courses || []) {
    if (c?.code && c?.title && !titleMap.has(normalizeCode(c.code))) {
      titleMap.set(normalizeCode(c.code), c.title);
    }
  }

  const rawItems = Array.isArray(data?.overview?.ods?.items)
    ? data.overview.ods.items
    : null;

  if (rawItems) {
    return sortRecordsNewestFirst(
      rawItems.map((item) => {
        const code = item.courseCode || item.code || "";
        const resolvedTitle =
          (item.courseTitle &&
            normalizeCode(item.courseTitle) !== normalizeCode(code) &&
            item.courseTitle) ||
          titleMap.get(normalizeCode(code)) ||
          item.courseTitle ||
          code ||
          "Course";
        return {
          ...item,
          courseCode: code,
          courseTitle: resolvedTitle,
          hours: Number.isFinite(Number(item.hours)) ? Number(item.hours) : 1,
        };
      }),
    );
  }

  const byCourse = data?.overview?.attendanceHistory?.byCourse;
  if (!byCourse) return [];
  const derived = [];
  for (const entry of Object.values(byCourse)) {
    const code = entry?.code || "";
    const resolvedTitle = titleMap.get(normalizeCode(code)) || code || "Course";
    for (const rec of entry?.records || []) {
      if (rec.kind !== "od") continue;
      derived.push({
        date: rec.date || "",
        courseCode: code,
        courseTitle: resolvedTitle,
        slot: rec.slot || entry?.slot || "",
        day: rec.day || "",
        timing: rec.timing || "",
        hours: Number.isFinite(Number(rec.hours)) ? Number(rec.hours) : 1,
        status: rec.rawStatus || rec.status || "On Duty",
        ...(rec.remarks ? { remarks: rec.remarks } : {}),
      });
    }
  }
  return sortRecordsNewestFirst(derived);
}


export function findNextCourseClasses(
  course,
  timetable,
  calendar,
  options = {},
) {
  if (!course || !timetable?.available || !Array.isArray(timetable.classes)) {
    return [];
  }
  const {
    count = 3,
    today = todayISO(),
    nowMinutes = istMinutesNow(new Date()),
    maxDaysAhead = 35,
  } = options || {};

  const targetCode = normalizeCode(course.code);
  const courseTypeText = String(course.type || "");
  const courseHasType = /lab|theory/i.test(courseTypeText);
  const courseIsLab = /lab/i.test(courseTypeText);

  const upcoming = [];
  for (let offset = 0; offset <= maxDaysAhead && upcoming.length < count; offset++) {
    const date = shiftDate(today, offset);
    const sched = scheduleForDate(timetable, calendar, date);
    if (!sched.available || sched.holiday || !sched.classes.length) continue;

    for (const item of sched.classes) {
      if (upcoming.length >= count) break;
      if (normalizeCode(item.code) !== targetCode) continue;
      if (courseHasType && item.type) {
        const itemIsLab = /lab|^LO$/i.test(item.type);
        if (itemIsLab !== courseIsLab) continue;
      }
      if (offset === 0 && Number.isFinite(nowMinutes)) {
        const startMin = clockToMinutes(item.start);
        if (startMin !== null && startMin < nowMinutes) continue;
      }
      upcoming.push({
        key: `${date}|${item.code}|${item.start}|${item.slot || ""}`,
        date,
        start: item.start || "",
        end: item.end || "",
        slot: item.slot || "",
        units: attendanceUnits(item) || 1,
      });
    }
  }
  return upcoming;
}

export function projectCourseMiniSim(course, upcomingClasses = [], choices = {}) {
  const baseAttended = Number(course?.attended) || 0;
  const baseTotal = Number(course?.total) || 0;
  const beforePercent = baseTotal > 0 ? (baseAttended / baseTotal) * 100 : null;

  let presentUnits = 0;
  let absentUnits = 0;
  for (const cls of upcomingClasses) {
    const status = choices[cls.key] || "ignore";
    const units = Number(cls.units) || 1;
    if (status === "present") presentUnits += units;
    else if (status === "absent") absentUnits += units;
  }

  const attended = baseAttended + presentUnits;
  const total = baseTotal + presentUnits + absentUnits;
  const percent = total > 0 ? (attended / total) * 100 : null;
  const diff =
    beforePercent !== null && percent !== null ? percent - beforePercent : null;

  return {
    attended,
    total,
    percent,
    beforePercent,
    diff,
    presentUnits,
    absentUnits,
    hasChanges: presentUnits > 0 || absentUnits > 0,
  };
}
