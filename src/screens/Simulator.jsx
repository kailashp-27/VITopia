import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  simulationDays,
  simulateAttendance,
  nextAttendanceStatus,
} from "../simulator.js";
import { todayISO } from "../calendar-utils.js";
import { shiftDate, weekDates } from "../schedule.js";
import "../simulator.css";

const percent = (value) => (value === null ? "—" : `${value.toFixed(1)}%`);
const changeLabel = (before, after) => {
  if (before === null || after === null) return "No baseline yet";
  const difference = after - before;
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} percentage points`;
};
const dateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

export default function Simulator({ data }) {
  const tomorrow = shiftDate(todayISO(), 1);
  const nextMonday = weekDates(shiftDate(todayISO(), 7))[0].date;
  const [mode, setMode] = useState("day");
  const [dayDate, setDayDate] = useState(tomorrow);
  const [weekDate, setWeekDate] = useState(nextMonday);
  const [choices, setChoices] = useState({});
  const days = simulationDays(
    data,
    mode === "day" ? [dayDate] : weekDates(weekDate).map((item) => item.date),
  );
  const result = simulateAttendance(data?.attendance || [], days, choices);
  const affected = result.courses.filter(
    (course) => course.present || course.absent,
  );
  const update = (key, value) =>
    setChoices((current) => ({ ...current, [key]: value }));
  const ignoreDay = (day) =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(day.classes.map((item) => [item.key, "ignore"])),
    }));
  const reset = () =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(
        days.flatMap((day) => day.classes.map((item) => [item.key, "present"])),
      ),
    }));
  return (
    <div className="simulator-screen">
      <div
        className="simulator-modes"
        role="group"
        aria-label="Simulation mode"
      >
        {["day", "week"].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === "day" ? "Day" : "Week"}
          </button>
        ))}
      </div>
      <label className="simulation-date">
        {mode === "day" ? "Choose a day" : "Week starting Monday"}
        <input
          type="date"
          value={mode === "day" ? dayDate : weekDate}
          min={mode === "day" ? tomorrow : nextMonday}
          step={mode === "week" ? 7 : 1}
          onChange={(event) => {
            const value = event.target.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
            if (mode === "day" && value >= tomorrow) setDayDate(value);
            if (
              mode === "week" &&
              value >= nextMonday &&
              weekDates(value)[0].date === value
            )
              setWeekDate(value);
          }}
        />
      </label>
      <p className="simulation-note">
        Tap a class to cycle Present → Absent → Ignore. All classes start
        Present. Ignore leaves attendance unchanged; lab blocks count by
        periods.
      </p>
      <section
        className="simulation-overall"
        aria-label="Overall attendance projection"
        aria-live="polite"
      >
        <span>Overall attendance</span>
        <div>
          <span>{percent(result.before.percent)}</span>
          <span aria-hidden="true">→</span>
          <strong>{percent(result.after.percent)}</strong>
        </div>
        <small>
          {changeLabel(result.before.percent, result.after.percent)}
        </small>
        <p>
          {result.present} present · {result.absent} absent periods planned
        </p>
      </section>
      <div className="simulation-plan-heading">
        <h2>Your plan</h2>
        <button type="button" className="text-button" onClick={reset}>
          Reset plan
        </button>
      </div>
      {!data?.overview?.timetable?.available ? (
        <p className="empty-inline">
          Sync your timetable from Profile to simulate attendance.
        </p>
      ) : (
        days.map((day) => {
          const DayContainer = mode === "week" ? "details" : "section";
          const DayHeading = mode === "week" ? "summary" : "header";
          return (
            <DayContainer
              className="simulation-day"
              key={`${mode}-${day.date}`}
              aria-label={dateLabel(day.date)}
            >
              <DayHeading>
                <h3>{dateLabel(day.date)}</h3>
                {mode === "week" ? (
                  <>
                    <small>
                      {day.classes.length
                        ? `${day.classes.length} classes`
                        : day.holiday
                          ? "Holiday"
                          : "No classes"}
                    </small>
                    <ChevronDown size={17} aria-hidden="true" />
                  </>
                ) : null}
              </DayHeading>
              {mode === "week" && day.classes.length ? (
                <button
                  type="button"
                  className="text-button ignore-simulation-day"
                  onClick={() => ignoreDay(day)}
                >
                  Ignore day
                </button>
              ) : null}
              <p className="schedule-caption">
                {day.holiday ? "Holiday · no classes" : day.label}
              </p>
              {!day.classes.length ? (
                <p className="simulation-note">
                  {day.holiday
                    ? "No classes on this holiday."
                    : "No classes scheduled."}
                </p>
              ) : (
                day.classes.map((item) => {
                  const eligible = item.matched && !!item.units;
                  const status = eligible
                    ? choices[item.key] || "present"
                    : "ignore";
                  const label = {
                    present: "Present",
                    absent: "Absent",
                    ignore: "Ignore",
                  }[status];
                  const title =
                    data?.attendance?.find(
                      (course) => course.code === item.code,
                    )?.title ||
                    item.title ||
                    item.code;
                  return (
                    <button
                      type="button"
                      className={`simulation-class ${status}`}
                      key={item.key}
                      disabled={!eligible}
                      aria-label={`${title}, ${item.start}, ${label}. Tap to mark ${nextAttendanceStatus(status)}.`}
                      onClick={() =>
                        update(item.key, nextAttendanceStatus(status))
                      }
                    >
                      <span className="simulation-class-heading">
                        <time>
                          {item.start}–{item.end}
                        </time>
                        <span>
                          {item.units
                            ? `${item.units} period${item.units > 1 ? "s" : ""}`
                            : "Periods unavailable"}
                        </span>
                      </span>
                      <strong className="simulation-class-title">
                        {title}
                      </strong>
                      <small>
                        {item.code} · {item.type}
                      </small>
                      <span className="simulation-status">{label}</span>
                      {!eligible ? (
                        <span className="simulation-note">
                          Attendance details unavailable; excluded from
                          projection.
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </DayContainer>
          );
        })
      )}
      <section
        className="simulation-results"
        aria-label="Course attendance projections"
        aria-live="polite"
      >
        <h2>Course projections</h2>
        {!affected.length ? (
          <p className="simulation-note">
            Mark classes Present or Absent to see each course’s change.
          </p>
        ) : (
          affected.map((course) => (
            <article key={course.code}>
              <h3>{course.title || course.code}</h3>
              <small>
                {course.code} · {course.type}
              </small>
              <div className="simulation-scores">
                <span>{percent(course.before)}</span>
                <span aria-hidden="true">→</span>
                <strong className={course.percent < 75 ? "warning" : ""}>
                  {percent(course.percent)}
                </strong>
              </div>
              <p>{changeLabel(course.before, course.percent)}</p>
              <small>
                {course.attended - course.present}/
                {course.total - course.present - course.absent} →{" "}
                {course.attended}/{course.total} attended · +{course.present}{" "}
                present, +{course.absent} absent
              </small>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
