import { overallAttendance } from "./calc.js";
import { clockToMinutes, scheduleForDate, shiftDate } from "./schedule.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function datesInRange(startISO, endISO, maxDays = 60) {
  if (!ISO_DATE.test(startISO || "") || !ISO_DATE.test(endISO || "")) return [];
  if (endISO < startISO) return [];
  const limit = Math.max(1, Number(maxDays) || 60);
  const dates = [];
  let cursor = startISO;
  while (cursor <= endISO && dates.length < limit) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return dates;
}

export function sessionKey(date, item) {
  return [date, item.code, item.type, item.start, item.slot].join("|");
}

export function nextAttendanceStatus(status = "present") {
  return (
    { present: "absent", absent: "ignore", ignore: "present" }[status] ||
    "present"
  );
}

export function attendanceUnits(item) {
  if (Number.isInteger(item.periods) && item.periods > 0) return item.periods;
  // Cached timetables predate the explicit period count; merged lab slots
  // preserve each original attendance period (L1+L2 = two).
  if (/lab|^LO$/i.test(item.type || "")) {
    const slots = (item.slot || "")
      .split("+")
      .filter((s) => /^L\d+$/i.test(s.trim()));
    return slots.length || null;
  }
  return 1;
}

export function simulationDays(data, dates, options = {}) {
  const courses = data?.attendance || [];
  const { today = null, nowMinutes = null, omitFinishedToday = false } =
    options || {};
  const hasCutoff = Boolean(today && Number.isFinite(nowMinutes));
  const result = [];
  for (const date of dates) {
    const schedule = scheduleForDate(
      data?.overview?.timetable,
      data?.calendar,
      date,
    );
    const filteredClasses =
      hasCutoff && date === today
        ? schedule.classes.filter((item) => {
            const startMin = clockToMinutes(item.start);
            return startMin === null || startMin >= nowMinutes;
          })
        : schedule.classes;
    if (
      omitFinishedToday &&
      hasCutoff &&
      date === today &&
      !filteredClasses.length
    ) {
      continue;
    }
    result.push({
      ...schedule,
      date,
      classes: filteredClasses.map((item) => {
        const matches = courses.filter((course) => course.code === item.code);
        return {
          ...item,
          key: sessionKey(date, item),
          units: attendanceUnits(item),
          matched: matches.length === 1,
        };
      }),
    });
  }
  return result;
}

export function simulateAttendance(courses, days, choices) {
  const additions = new Map();
  for (const day of days) {
    if (!day.available || day.holiday) continue;
    for (const item of day.classes) {
      const status = choices[item.key] || "present";
      if (
        !item.matched ||
        !item.units ||
        !["present", "absent"].includes(status)
      )
        continue;
      const change = additions.get(item.code) || { present: 0, absent: 0 };
      change[status] += item.units;
      additions.set(item.code, change);
    }
  }
  const results = courses.map((course) => {
    const { present = 0, absent = 0 } = additions.get(course.code) || {};
    const attended = course.attended + present;
    const total = course.total + present + absent;
    return {
      ...course,
      attended,
      total,
      present,
      absent,
      before: course.total ? (100 * course.attended) / course.total : null,
      percent: total ? (100 * attended) / total : null,
    };
  });
  return {
    courses: results,
    before: overallAttendance(courses),
    after: overallAttendance(results),
    present: results.reduce((sum, c) => sum + c.present, 0),
    absent: results.reduce((sum, c) => sum + c.absent, 0),
  };
}


export function daySimulationState(day, choices = {}) {
  if (!day || !day.available || day.holiday) return "empty";
  const eligible = (day.classes || []).filter(
    (item) => item.matched && !!item.units,
  );
  if (!eligible.length) return "empty";
  let present = 0;
  let absent = 0;
  let ignore = 0;
  for (const item of eligible) {
    const status = choices[item.key] || "present";
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else ignore++;
  }
  if (present === eligible.length) return "all-present";
  if (absent === eligible.length) return "all-absent";
  if (ignore === eligible.length) return "all-ignore";
  return "mixed";
}
