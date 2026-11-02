import { overallAttendance } from "./calc.js";
import { scheduleForDate } from "./schedule.js";

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

export function simulationDays(data, dates) {
  const courses = data?.attendance || [];
  return dates.map((date) => {
    const schedule = scheduleForDate(
      data?.overview?.timetable,
      data?.calendar,
      date,
    );
    return {
      ...schedule,
      date,
      classes: schedule.classes.map((item) => {
        const matches = courses.filter((course) => course.code === item.code);
        return {
          ...item,
          key: sessionKey(date, item),
          units: attendanceUnits(item),
          matched: matches.length === 1,
        };
      }),
    };
  });
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
