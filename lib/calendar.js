import { load } from "cheerio";
import { AppError } from "./errors.js";
import { academicDayStatus } from "../src/calendar-utils.js";
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const clean = (value) => value.replace(/\s+/g, " ").trim();
export function calendarMonthKey(token) {
  const match = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(token);
  const month = match ? MONTHS.indexOf(match[2]) : -1;
  return month < 0 ? null : `${match[3]}-${String(month + 1).padStart(2, "0")}`;
}
export function parseCalendarMonths(html) {
  const values = [
    ...html.matchAll(/processViewCalendar\s*\([^)]*?(\d{2}-[A-Z]{3}-\d{4})/g),
  ].map((match) => match[1]);
  const months = [...new Set(values)].filter(calendarMonthKey);
  if (!months.length)
    throw new AppError(
      "CALENDAR_UNAVAILABLE",
      "VTOP did not return an academic calendar for this semester.",
      502,
    );
  return months;
}
export function parseCalendarDays(html, token) {
  const month = calendarMonthKey(token);
  if (!month)
    throw new AppError(
      "CALENDAR_UNAVAILABLE",
      "VTOP returned an invalid calendar month.",
      502,
    );
  const [year, monthNumber] = month.split("-").map(Number);
  const maxDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const $ = load(html);
  const table = $("table.calendar-table").first().length
    ? $("table.calendar-table").first()
    : $("#list-wrapper table").first();
  if (!table.length)
    throw new AppError(
      "CALENDAR_UNAVAILABLE",
      "The VTOP academic calendar format was not recognized.",
      502,
    );
  const days = new Map();
  table.find("td").each((_, cell) => {
    const spans = $(cell)
      .find("span")
      .map((_, span) => clean($(span).text()))
      .get();
    if (!/^\d{1,2}$/.test(spans[0] || "")) return;
    const day = Number(spans[0]);
    if (day < 1 || day > maxDay) return;
    // Read all day text, not just parenthesized spans. VTOP can label a
    // vacation below a generic "Instructional Day" tag.
    const clone = $(cell).clone();
    clone.find("br").replaceWith("\n");
    clone.find("span,div,p").append("\n");
    const parts = clone.text().split(/\n/).map(clean).filter(Boolean);
    const labels = parts
      .filter(
        (text) =>
          !/^\d{1,2}$/.test(text) &&
          !/^(?:(?:no|non)[ -]?)?instructional day$/i.test(text),
      )
      .map((text) => text.replace(/^\(|\)$/g, "").trim())
      .filter(Boolean);
    const label = [...new Set(labels)].join(" / ");
    const fullText = parts.join(" ");
    const rawInstructional =
      /\binstructional day\b/i.test(fullText) &&
      !/\b(?:no|non)[ -]?instructional day\b/i.test(fullText);
    const hasStatus = /\binstructional day\b/i.test(fullText);
    const status = academicDayStatus({
      label,
      instructional: hasStatus ? rawInstructional : null,
    });
    const instructional = status === "unknown" ? null : status === "working";
    const dayOrder = fullText.match(
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+Day Order/i,
    )?.[1];
    const date = `${month}-${String(day).padStart(2, "0")}`;
    days.set(date, {
      date,
      instructional,
      label,
      ...(rawInstructional && status === "holiday" ? { conflict: true } : {}),
      dayOrder:
        instructional && dayOrder
          ? dayOrder[0].toUpperCase() + dayOrder.slice(1).toLowerCase()
          : null,
    });
  });
  if (!days.size)
    throw new AppError(
      "CALENDAR_UNAVAILABLE",
      "No dated entries were found in the VTOP calendar.",
      502,
    );
  // Expand only explicit ranges in this month's own holiday text. No festival
  // dates are inferred; ambiguous/cross-month prose remains a label.
  for (const source of [...days.values()]) {
    if (!/\bholidays?\b|\bvacation\b/i.test(source.label)) continue;
    const range =
      /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|[-–—])\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?\b/i.exec(
        source.label,
      );
    if (
      !range ||
      MONTHS.indexOf(range[3].slice(0, 3).toUpperCase()) !== monthNumber - 1 ||
      (range[4] && Number(range[4]) !== year)
    )
      continue;
    const first = Number(range[1]),
      last = Number(range[2]);
    if (first < 1 || last < first || last > maxDay) continue;
    for (let d = first; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      const previous = days.get(date);
      if (!previous) continue;
      days.set(date, {
        ...previous,
        instructional: false,
        dayOrder: null,
        label: [
          ...new Set(
            [...previous.label.split(" / "), source.label].filter(Boolean),
          ),
        ].join(" / "),
        ...(previous.instructional === true ? { conflict: true } : {}),
      });
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export async function fetchAcademicCalendar(client, semesterId) {
  await client.authenticated("academics/common/CalendarPreview", {
    verifyMenu: "true",
  });
  const html = await client.authenticated("getListForSemester", {
    paramReturnId: "getListForSemester",
    semSubId: semesterId,
    classGroupId: "COMB",
  });
  const tokens = parseCalendarMonths(html);
  if (tokens.length > 12)
    throw new AppError(
      "CALENDAR_UNAVAILABLE",
      "VTOP returned too many calendar months. Please try again.",
      502,
    );
  const days = [];
  // Two bounded HTTP requests at a time; never discard an existing cache on failure.
  for (let i = 0; i < tokens.length; i += 2) {
    const results = await Promise.all(
      tokens.slice(i, i + 2).map(async (token) =>
        parseCalendarDays(
          await client.authenticated("processViewCalendar", {
            calDate: token,
            semSubId: semesterId,
            classGroupId: "COMB",
          }),
          token,
        ),
      ),
    );
    days.push(...results.flat());
  }
  return {
    source: "VTOP academic calendar",
    semesterId,
    fetchedAt: new Date().toISOString(),
    months: tokens.map(calendarMonthKey),
    days: [...new Map(days.map((day) => [day.date, day])).values()].sort(
      (a, b) => a.date.localeCompare(b.date),
    ),
  };
}
