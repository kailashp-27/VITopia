import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import {
  datesInRange,
  daySimulationState,
  simulationDays,
  simulateAttendance,
  nextAttendanceStatus,
} from "../simulator.js";
import { todayISO } from "../calendar-utils.js";
import { istMinutesNow, shiftDate } from "../schedule.js";
import { triggerLightHaptic } from "../native-bridge.js";
import "../simulator.css";

function buildCourseMap(results) {
  return new Map(results.map((c) => [c.code, c]));
}

const percent = (value) => (value === null ? "—" : `${value.toFixed(1)}%`);
const pctDiff = (before, after) => {
  if (before === null || after === null) return null;
  return after - before;
};
const dateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
const shortDateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

const QUICK_OFFSETS = [
  { offset: 1, label: "Tomorrow" },
  { offset: 3, label: "+3 days" },
  { offset: 7, label: "+7 days" },
  { offset: 14, label: "+14 days" },
];

const DAY_STATE_LABELS = {
  "all-present": "All present",
  "all-absent": "All absent",
  "all-ignore": "Ignored",
  mixed: "Mixed",
};

export default function Simulator({ data }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const today = todayISO();
  const tomorrow = shiftDate(today, 1);
  const maxDate = shiftDate(today, 59);
  const nowMinutes = istMinutesNow(now);
  const todayHasRemaining =
    (simulationDays(data, [today], { today, nowMinutes })[0]?.classes?.length ||
      0) > 0;
  const startDate = todayHasRemaining ? today : tomorrow;

  const [targetDate, setTargetDate] = useState(() => shiftDate(today, 1));
  const [choices, setChoices] = useState({});
  const dateInputRef = useRef(null);

  const effectiveTarget = targetDate < startDate ? startDate : targetDate;
  const rangeDates = datesInRange(startDate, effectiveTarget, 60);
  const days = simulationDays(data, rangeDates, {
    today,
    nowMinutes,
    omitFinishedToday: true,
  });
  const result = simulateAttendance(data?.attendance || [], days, choices);
  const courseMap = buildCourseMap(result.courses);

  const overallDiff = pctDiff(result.before.percent, result.after.percent);
  const overallDiffState =
    overallDiff === null || Math.abs(overallDiff) < 0.05
      ? "neutral"
      : overallDiff > 0
        ? "up"
        : "down";
  const overallDiffText =
    overallDiff === null
      ? "—"
      : Math.abs(overallDiff) < 0.05
        ? "0.0%"
        : `${overallDiff > 0 ? "+" : ""}${overallDiff.toFixed(1)}%`;

  const afterPct = result.after.percent;
  const afterTier =
    afterPct === null
      ? "neutral"
      : afterPct < 75
        ? "danger"
        : afterPct <= 80
          ? "warning"
          : "good";

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
      }
    } catch {
      input.focus();
    }
  };

  const update = (key, value) => {
    void triggerLightHaptic();
    setChoices((current) => ({ ...current, [key]: value }));
  };
  const ignoreDay = (day) =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(day.classes.map((item) => [item.key, "ignore"])),
    }));
  const markAllAbsent = (day) =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(
        day.classes
          .filter((item) => item.matched && !!item.units)
          .map((item) => [item.key, "absent"]),
      ),
    }));
  const markAllPresent = (day) =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(
        day.classes
          .filter((item) => item.matched && !!item.units)
          .map((item) => [item.key, "present"]),
      ),
    }));
  const reset = () =>
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(
        days.flatMap((day) => day.classes.map((item) => [item.key, "present"])),
      ),
    }));

  const startLabel = startDate === today ? "Today" : "Tomorrow";
  const rangeSummary =
    rangeDates.length <= 1
      ? `${startLabel} (${shortDateLabel(startDate)})`
      : `${startLabel} → ${shortDateLabel(effectiveTarget)} · ${rangeDates.length} days`;

  return (
    <div className="simulator-screen">
      <div className="simulation-range-card">
        <div className="simulation-date">
          <div className="simulation-date-top">
            <label htmlFor="sim-target-date">Select end date</label>
            <span className="simulation-range-badge">{rangeSummary}</span>
          </div>
          <div className="simulation-date-picker-wrap" onClick={openDatePicker}>
            <CalendarIcon
              size={16}
              className="simulation-date-icon"
              aria-hidden="true"
            />
            <input
              ref={dateInputRef}
              id="sim-target-date"
              type="date"
              value={effectiveTarget}
              min={startDate}
              max={maxDate}
              onClick={(e) => e.stopPropagation()}
              onChange={(event) => {
                const value = event.target.value;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
                if (value >= startDate && value <= maxDate) {
                  void triggerLightHaptic();
                  setTargetDate(value);
                }
              }}
            />
          </div>
        </div>

        <div
          className="simulation-quick-chips"
          role="group"
          aria-label="Quick date range presets"
        >
          {QUICK_OFFSETS.map(({ offset, label }) => {
            const presetDate = shiftDate(today, offset);
            const active = effectiveTarget === presetDate;
            return (
              <button
                key={offset}
                type="button"
                aria-pressed={active}
                className={`simulation-quick-chip ${active ? "active" : ""}`}
                onClick={() => {
                  void triggerLightHaptic();
                  setTargetDate(presetDate);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <section
        className={`simulation-overall is-${overallDiffState}`}
        aria-label="Overall attendance projection"
        aria-live="polite"
      >
        <div className="simulation-overall-left">
          <span className="simulation-overall-label">Overall attendance</span>
          <div className="simulation-overall-values">
            <span className="simulation-overall-before">
              {percent(result.before.percent)}
            </span>
            <span className="simulation-overall-arrow" aria-hidden="true">
              →
            </span>
            <strong className={`simulation-overall-after tier-${afterTier}`}>
              {percent(result.after.percent)}
            </strong>
          </div>
        </div>
        <span className={`simulation-delta-pill is-${overallDiffState}`}>
          {overallDiffText}
        </span>
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
          const dayState = daySimulationState(day, choices);
          const stateText = DAY_STATE_LABELS[dayState];
          return (
            <details
              className={`simulation-day day-state-${dayState}`}
              key={day.date}
              aria-label={dateLabel(day.date)}
            >
              <summary>
                <h3>
                  {day.date === today
                    ? `Today · ${shortDateLabel(day.date)}`
                    : dateLabel(day.date)}
                </h3>
                <small className={`day-state-meta state-${dayState}`}>
                  {day.classes.length
                    ? `${day.classes.length} ${day.classes.length === 1 ? "class" : "classes"}${stateText ? ` · ${stateText}` : ""}`
                    : day.holiday
                      ? "Holiday"
                      : "No classes"}
                </small>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <div className="simulation-day-subheading">
                {day.holiday || day.label ? (
                  <p className="schedule-caption">
                    {day.holiday ? "Holiday · no classes" : day.label}
                  </p>
                ) : null}
                {day.classes.length ? (
                  <div className="simulation-day-actions">
                    <button
                      type="button"
                      className="text-button absent-simulation-day"
                      onClick={() => markAllAbsent(day)}
                    >
                      All absent
                    </button>
                    <button
                      type="button"
                      className="text-button present-simulation-day"
                      onClick={() => markAllPresent(day)}
                    >
                      All present
                    </button>
                    <button
                      type="button"
                      className="text-button ignore-simulation-day"
                      onClick={() => ignoreDay(day)}
                    >
                      Ignore day
                    </button>
                  </div>
                ) : null}
              </div>
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
                  const courseResult = courseMap.get(item.code);
                  const diff =
                    eligible && courseResult
                      ? pctDiff(courseResult.before, courseResult.percent)
                      : null;
                  const showDiff = diff !== null;
                  const diffLabel =
                    diff === null
                      ? null
                      : diff === 0
                        ? "unchanged"
                        : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`;
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
                      <div className="simulation-class-footer">
                        <span className="simulation-status">{label}</span>
                        {showDiff && courseResult ? (
                          <span
                            className={`simulation-class-pct ${diff > 0 ? "pct-up" : diff < 0 ? "pct-down" : "pct-same"}`}
                          >
                            {percent(courseResult.percent)}
                            <span className="pct-delta">{diffLabel}</span>
                          </span>
                        ) : null}
                      </div>
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
            </details>
          );
        })
      )}
    </div>
  );
}
