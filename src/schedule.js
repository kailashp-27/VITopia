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
        : status === "unknown"
          ? "Weekly timetable · academic day not synced"
          : "Working day",
    classes,
  };
}
export function classTiming(item, minutes) {
  const toMinutes = (clock) => {
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + m;
  };
  return minutes >= toMinutes(item.end)
    ? "finished"
    : minutes >= toMinutes(item.start)
      ? "current"
      : "upcoming";
}
