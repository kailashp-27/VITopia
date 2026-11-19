import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  TrendingUp,
  Check,
  CircleHelp,
  X,
} from "lucide-react";
import {
  attendancePlan,
  projectAttendance,
  weightedMarks,
} from "../calc.js";
import {
  findCourseHistory,
  findNextCourseClasses,
  projectCourseMiniSim,
  sortRecordsNewestFirst,
  summarizeAttendanceRecords,
} from "../attendance-history.js";
import { marksCourseKey } from "../marks-updates.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
import { triggerLightHaptic } from "../native-bridge.js";
const number = (n) => (n === null || !Number.isFinite(n) ? "—" : n.toFixed(1));
const courseKey = (c) => `${c.code}-${c.type}-${c.slot || ""}`;
function Status({ course, target = 75 }) {
  const plan = attendancePlan(course.attended, course.total, target);
  if (!course.total)
    return <span className="course-status">No classes recorded</span>;
  return (
    <span className="course-status">
      {plan.attend ? (
        <>
          <TrendingUp size={14} /> Attend next {plan.attend}
        </>
      ) : plan.skip ? (
        <>
          <Check size={14} /> Can skip {plan.skip}{" "}
          {plan.skip === 1 ? "class" : "classes"}
        </>
      ) : (
        <>
          <CircleHelp size={14} /> No classes to skip yet
        </>
      )}
    </span>
  );
}
export function Ring({ percent, size = 160, label = "overall attendance" }) {
  const r = 62,
    circumference = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 148 148" aria-hidden="true">
        <circle className="ring-track" cx="74" cy="74" r={r} />
        <circle
          className="ring-fill"
          cx="74"
          cy="74"
          r={r}
          strokeDasharray={`${(circumference * (percent || 0)) / 100} ${circumference}`}
          transform="rotate(-90 74 74)"
        />
      </svg>
      <div>
        <strong>
          {number(percent)}
          <span>%</span>
        </strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
function formatUpcomingDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function AttendanceHistoryModal({
  course,
  attendanceHistory,
  timetable = null,
  calendar = null,
  target = 75,
  onClose,
}) {
  const [simOpen, setSimOpen] = useState(false);
  const [simChoices, setSimChoices] = useState({});

  useBackOverlay(Boolean(course), onClose);

  useEffect(() => {
    setSimOpen(false);
    setSimChoices({});
  }, [course]);

  useEffect(() => {
    if (!course) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [course, onClose]);

  if (!course) return null;

  const upcomingClasses = simOpen
    ? findNextCourseClasses(course, timetable, calendar, { count: 3 })
    : [];
  const projected = projectCourseMiniSim(course, upcomingClasses, simChoices);

  const displayAttended = projected.hasChanges
    ? projected.attended
    : course.attended;
  const displayTotal = projected.hasChanges ? projected.total : course.total;
  const numPct = projected.hasChanges
    ? projected.percent
    : course.total > 0
      ? (course.attended / course.total) * 100
      : Number.isFinite(course.percent)
        ? Number(course.percent)
        : null;

  let tier = "good";
  if (numPct === null) tier = "neutral";
  else if (numPct < target) tier = "danger";
  else if (numPct <= 80) tier = "warning";
  else tier = "good";

  const entry = findCourseHistory(course, attendanceHistory);
  const records = entry ? sortRecordsNewestFirst(entry.records || []) : [];
  const counts = summarizeAttendanceRecords(records);

  const toggleSimChoice = (key, nextStatus) => {
    void triggerLightHaptic();
    setSimChoices((current) => {
      const existing = current[key] || "ignore";
      return {
        ...current,
        [key]: existing === nextStatus ? "ignore" : nextStatus,
      };
    });
  };

  const simDiffText =
    projected.hasChanges && projected.diff !== null
      ? Math.abs(projected.diff) < 0.05
        ? "0.0%"
        : `${projected.diff > 0 ? "+" : ""}${projected.diff.toFixed(1)}%`
      : null;
  const simDiffState =
    !projected.hasChanges || projected.diff === null || Math.abs(projected.diff) < 0.05
      ? "neutral"
      : projected.diff > 0
        ? "up"
        : "down";

  return (
    <div
      className="modal-backdrop attendance-history-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-history-heading"
        className="attendance-history-modal"
      >
        <div className="attendance-history-header">
          <div className="attendance-history-heading-group">
            <h2 id="attendance-history-heading">
              {course.title || course.code}
            </h2>
            <div className="attendance-history-submeta">
              <span className={`attendance-history-pct ${tier}`}>
                {number(numPct)}%
              </span>
              {simDiffText ? (
                <span className={`history-sim-delta is-${simDiffState}`}>
                  {simDiffText}
                </span>
              ) : null}
              <span className="attendance-history-ratio">
                {displayAttended} / {displayTotal} classes
              </span>
            </div>
            {counts.od > 0 ? (
              <div className="attendance-history-od-note">
                <span className="history-od-dot" aria-hidden="true" />
                <span>
                  On Duty in this class: <strong>{counts.od}</strong>
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button attendance-history-close"
            aria-label="Close attendance history"
            onClick={onClose}
            autoFocus
          >
            <X size={18} />
          </button>
        </div>

        <div className="course-mini-sim-wrap">
          <button
            type="button"
            className={`course-mini-sim-toggle ${simOpen ? "is-open" : ""}`}
            aria-expanded={simOpen}
            onClick={() => {
              void triggerLightHaptic();
              setSimOpen((open) => !open);
            }}
          >
            <span>Simulate next 3 classes</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>

          {simOpen ? (
            <div className="course-mini-sim-panel">
              {upcomingClasses.length ? (
                <>
                  <div className="course-mini-sim-list">
                    {upcomingClasses.map((cls) => {
                      const status = simChoices[cls.key] || "ignore";
                      return (
                        <div
                          key={cls.key}
                          className={`course-mini-sim-row status-${status}`}
                        >
                          <div className="mini-sim-row-info">
                            <span className="mini-sim-row-date">
                              {formatUpcomingDate(cls.date)}
                            </span>
                            <span className="mini-sim-row-time">
                              {cls.start}–{cls.end}
                              {cls.units > 1 ? ` · ${cls.units} hrs` : ""}
                            </span>
                          </div>
                          <div className="mini-sim-row-actions">
                            <button
                              type="button"
                              aria-pressed={status === "present"}
                              className={`mini-sim-btn is-present ${status === "present" ? "active" : ""}`}
                              onClick={() => toggleSimChoice(cls.key, "present")}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              aria-pressed={status === "absent"}
                              className={`mini-sim-btn is-absent ${status === "absent" ? "active" : ""}`}
                              onClick={() => toggleSimChoice(cls.key, "absent")}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {projected.hasChanges ? (
                    <div className="course-mini-sim-footer">
                      <span>
                        Projected:{" "}
                        <strong className={`mini-sim-proj-val ${tier}`}>
                          {number(projected.percent)}%
                        </strong>{" "}
                        ({projected.attended}/{projected.total})
                      </span>
                      <button
                        type="button"
                        className="text-button mini-sim-reset"
                        onClick={() => setSimChoices({})}
                      >
                        Reset
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mini-sim-empty">
                  {timetable?.available
                    ? "No upcoming classes scheduled for this subject."
                    : "Sync your timetable to simulate upcoming classes."}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {records.length ? (
          <div className="attendance-history-list" role="list">
            {records.map((rec, idx) => {
              const subParts = [
                rec.slot || entry?.slot || "",
                rec.day &&
                !rec.timing?.toLowerCase().includes(rec.day.toLowerCase())
                  ? rec.day
                  : "",
                rec.timing || "",
              ].filter(Boolean);
              const statusLabel =
                rec.kind === "od" && rec.rawStatus ? rec.rawStatus : rec.status;
              return (
                <div
                  key={`${rec.date}-${rec.timing}-${idx}`}
                  className={`attendance-history-row kind-${rec.kind}`}
                  role="listitem"
                >
                  <div className="history-row-left">
                    <span className="history-row-date">
                      {rec.date || "Date unavailable"}
                    </span>
                    {subParts.length ? (
                      <span className="history-row-meta">
                        {subParts.join(" · ")}
                      </span>
                    ) : null}
                  </div>
                  <span className={`history-status-badge is-${rec.kind}`}>
                    <span>{statusLabel}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="attendance-history-empty">
            <CalendarDays size={22} />
            <p>
              {!attendanceHistory?.available || !entry
                ? "Previous class dates haven't been synced yet. Sync again to load date-wise attendance from VTOP."
                : "No class attendance dates recorded yet for this subject."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function CourseTable({
  courses = [],
  target = 75,
  attendanceHistory = null,
  timetable = null,
  calendar = null,
}) {
  const [selectedCourse, setSelectedCourse] = useState(null);

  const sortedCourses = [...courses].sort((a, b) => {
    const pa =
      a.total > 0
        ? (a.attended / a.total) * 100
        : Number.isFinite(a.percent)
          ? Number(a.percent)
          : 100;
    const pb =
      b.total > 0
        ? (b.attended / b.total) * 100
        : Number.isFinite(b.percent)
          ? Number(b.percent)
          : 100;
    if (pa !== pb) return pa - pb;
    return (a.title || a.code || "").localeCompare(b.title || b.code || "");
  });

  const openCourseHistory = (c) => {
    void triggerLightHaptic();
    setSelectedCourse(c);
  };

  return (
    <div className="attendance-screen-wrapper">
      {sortedCourses.length ? (
        <div className="course-list attendance-card-grid">
          {sortedCourses.map((c) => {
            const numPct =
              c.total > 0
                ? (c.attended / c.total) * 100
                : Number.isFinite(c.percent)
                  ? Number(c.percent)
                  : null;
            let tier = "good";
            if (numPct === null) tier = "neutral";
            else if (numPct < 75) tier = "danger";
            else if (numPct <= 80) tier = "warning";
            else tier = "good";

            return (
              <div
                className={`attendance-neat-card is-${tier}`}
                key={courseKey(c)}
                tabIndex={0}
                role="button"
                aria-label={`View attendance history for ${c.title || c.code}: ${number(numPct)}%`}
                onClick={() => openCourseHistory(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openCourseHistory(c);
                  }
                }}
              >
                <div className="attendance-card-header">
                  <span className="attendance-card-title">
                    {c.title || c.code}
                  </span>
                </div>

                <div className="attendance-card-numbers">
                  <span className={`attendance-percentage-num ${tier}`}>
                    {number(numPct)}
                    <small>%</small>
                  </span>
                  <span className="attendance-count-num">
                    {c.attended} / {c.total}
                  </span>
                </div>

                <div className="attendance-card-bottom">
                  <span className={`attendance-status-badge ${tier}`}>
                    <Status course={c} target={target} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-inline">No courses available.</div>
      )}

      <AttendanceHistoryModal
        course={selectedCourse}
        attendanceHistory={attendanceHistory}
        timetable={timetable}
        calendar={calendar}
        target={target}
        onClose={() => setSelectedCourse(null)}
      />
    </div>
  );
}
export function Marks({ data, newCourseKeys = [], onOpenCourses }) {
  const catalog = data.overview?.courses || [];
  return (
    <>
      <div className="marks-grid">
        {data.marks.map((c) => {
          const total = weightedMarks(c.components);
          const credits =
            c.credits ??
            catalog.find((course) => course.code === c.code)?.credits;
          return (
            <details
              onClick={(event) => {
                if (
                  !event.target.closest("summary, a, button, input, select, textarea") &&
                  !window.getSelection?.()?.toString()
                )
                  event.currentTarget.open = !event.currentTarget.open;
              }}
              className="marks-card collapsible-marks"
              key={courseKey(c)}
            >
              <summary>
                <span className="marks-heading">
                  <span className="course-code">
                    {c.code} · {c.type || "Course"}
                    {Number.isFinite(credits) ? ` · ${credits} credits` : ""}
                  </span>
                  {newCourseKeys.includes(marksCourseKey(c)) ? (
                    <span
                      className="new-marks-dot course-update-dot"
                      role="img"
                      aria-label="New or updated marks"
                    />
                  ) : null}
                </span>
                <span className="marks-course-title">{c.title}</span>
                <span className="marks-score" aria-label="Course total">
                  <strong>
                    {number(total.scored)}
                    <small> / {total.outOf}</small>
                  </strong>
                </span>
              </summary>
              <div className="mark-rows">
                {c.components.map((m, i) => (
                  <div key={`${m.name}-${i}`}>
                    <span>{m.name}</span>
                    <strong>
                      {m.scored === null ? (
                        <span className="muted">Pending</span>
                      ) : (
                        <>
                          {m.scored}
                          <small> / {m.max ?? "—"}</small>
                        </>
                      )}
                    </strong>
                  </div>
                ))}
              </div>
              {c.components.some(
                (m) => m.scored !== null && m.weight === null,
              ) ? (
                <p className="footnote">
                  Some weights are unavailable; those marks are excluded from
                  the total.
                </p>
              ) : null}
            </details>
          );
        })}
      </div>
      {!data.marks.length ? (
        <div className="empty-inline">
          No marks have been published for this semester.
        </div>
      ) : null}
      {onOpenCourses ? (
        <nav
          className="profile-page-list marks-courses-footer"
          aria-label="Course list shortcut"
        >
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onOpenCourses();
            }}
          >
            Course list <span aria-hidden="true">›</span>
          </button>
        </nav>
      ) : null}
    </>
  );
}
export function Calculator({ course, target, onClose }) {
  const [attend, setAttend] = useState(0);
  const [miss, setMiss] = useState(0);
  const initial = attendancePlan(course.attended, course.total, target);
  const projected = projectAttendance(
    course.attended,
    course.total,
    attend,
    miss,
    target,
  );
  useBackOverlay(true, onClose);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="calc-heading"
        className="calculator-modal"
      >
        <button
          className="icon-button close-button"
          aria-label="Close calculator"
          onClick={onClose}
          autoFocus
        >
          <X size={20} />
        </button>

        <h2 id="calc-heading">Attendance calculator</h2>
        <p>{course.title}</p>
        <Ring percent={projected.percent} label="projected attendance" />
        <div className="projection-sliders">
          <label className="range-label">
            <span>
              Classes to attend <strong>{attend}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={attend}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (next !== attend) void triggerLightHaptic();
                setAttend(next);
              }}
            />
            <span className="range-ends" aria-hidden="true">
              <span>0</span>
              <span>10</span>
            </span>
          </label>
          <label className="range-label">
            <span>
              Classes to miss <strong>{miss}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={miss}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (next !== miss) void triggerLightHaptic();
                setMiss(next);
              }}
            />
            <span className="range-ends" aria-hidden="true">
              <span>0</span>
              <span>10</span>
            </span>
          </label>
        </div>
        <p className="projected-count" aria-live="polite">
          {projected.attended} / {projected.total} classes ·{" "}
          {number(projected.percent)}%
        </p>
        <div className="calculator-result">
          {projected.percent === null
            ? "No classes recorded yet."
            : projected.percent < target
              ? `You would be below your ${target}% goal.`
              : `You would be at or above ${target}%.`}
          <small>
            Currently {course.attended}/{course.total} ·{" "}
            {initial.attend
              ? `Attend ${initial.attend} to reach ${target}%`
              : `Can skip ${initial.skip} at ${target}%`}
          </small>
        </div>
        <button
          type="button"
          className="text-button reset-projection"
          onClick={() => {
            if (attend !== 0 || miss !== 0) void triggerLightHaptic();
            setAttend(0);
            setMiss(0);
          }}
        >
          Reset
        </button>
        <p className="footnote">
          A projection only. Your saved attendance won’t change.
        </p>
      </section>
    </div>
  );
}
