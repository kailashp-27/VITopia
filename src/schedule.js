import { academicDayStatus } from "./calendar-utils.js";
export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export function shiftDate(date, offset) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function weekDates(date) {
  const index = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = shiftDate(date, -index);
  return DAYS.map((day, i) => ({ day, date: shiftDate(monday, i) }));
}
export function scheduleForDate(timetable, calendar, date) {
  const academic = calendar?.days?.find((day) => day.date === date);
  const status = academicDayStatus(academic);
  if (status === "holiday")
    return {
      available: true,
      holiday: true,
      label: academic?.label || "No classes",
      classes: [],
    };
  const day =
    academic?.dayOrder && status === "working"
      ? academic.dayOrder.slice(0, 3).toUpperCase()
      : DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
  const classes = timetable?.available
    ? (timetable.classes || [])
        .filter((item) => item.day === day)
        .sort((a, b) => a.start.localeCompare(b.start))
    : [];
  return {
    available: !!timetable?.available,
    holiday: false,
    label:
      academic?.dayOrder && status === "working"
        ? `${academic.dayOrder} day order`
        : status === "working"
          ? "Working day"
          : "",
    classes,
  };
}
export function clockToMinutes(clock) {
  if (!clock || typeof clock !== "string") return null;
  const parts = clock.split(":").map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]))
    return null;
  return parts[0] * 60 + parts[1];
}
export function istMinutesNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number);
  return parts[0] * 60 + parts[1];
}
export function classTiming(item, minutes) {
  const start = clockToMinutes(item.start);
  const end = clockToMinutes(item.end);
  if (start === null || end === null) return "upcoming";
  return minutes >= end ? "finished" : minutes >= start ? "current" : "upcoming";
}
