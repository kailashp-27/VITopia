import { useState } from "react";
import { TrendingUp, Check, CircleHelp, X } from "lucide-react";
import {
  attendancePlan,
  overallAttendance,
  projectAttendance,
  weightedMarks,
} from "../calc.js";
import { marksCourseKey } from "../marks-updates.js";
const number = (n) => (n === null || !Number.isFinite(n) ? "—" : n.toFixed(1));
const courseKey = (c) => `${c.code}-${c.type}-${c.slot || ""}`;
function Status({ course, target = 75 }) {
  const plan = attendancePlan(course.attended, course.total, target);
  if (!course.total)
    return <span className="course-status">No classes recorded</span>;
  return (
    <span className={`course-status ${plan.attend ? "warning" : ""}`}>
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
const isLabCourse = (c) =>
  /lab/i.test(c.type || "") ||
  (!/theory/i.test(c.type || "") && (c.code || "").trim().toUpperCase().endsWith("P"));

export function CourseTable({ courses, target = 75, onOpen }) {
  const [filter, setFilter] = useState("all");

  const overall = overallAttendance(courses);
  const belowCourses = courses.filter((c) => {
    const { percent } = attendancePlan(c.attended, c.total, target);
    return percent !== null && percent < target;
  });
  const theoryCourses = courses.filter((c) => !isLabCourse(c));
  const labCourses = courses.filter((c) => isLabCourse(c));

  const visibleCourses =
    filter === "below"
      ? belowCourses
      : filter === "theory"
        ? theoryCourses
        : filter === "lab"
          ? labCourses
          : courses;

  return (
    <div className="attendance-screen-wrapper">
      <div className="attendance-summary-strip">
        <div className="attendance-summary-left">
          <span className="attendance-summary-pct">
            {number(overall.percent)}%
          </span>
          <span className="attendance-summary-counts">
            Overall · {overall.attended} / {overall.total}
          </span>
        </div>
        <span
          className={`attendance-summary-alert ${belowCourses.length ? "warning" : "good"}`}
        >
          {belowCourses.length
            ? `${belowCourses.length} below ${target}%`
            : `All ${target}%+`}
        </span>
      </div>

      <div
        className="attendance-filter-pills"
        role="tablist"
        aria-label="Filter courses"
      >
        {[
          { id: "all", label: `All (${courses.length})` },
          {
            id: "below",
            label: `Below ${target}% (${belowCourses.length})`,
            warn: belowCourses.length > 0,
          },
          { id: "theory", label: `Theory (${theoryCourses.length})` },
          { id: "lab", label: `Lab (${labCourses.length})` },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            role="tab"
            aria-selected={filter === pill.id}
            className={`attendance-filter-pill ${filter === pill.id ? "active" : ""} ${pill.warn ? "has-warn" : ""}`}
            onClick={() => setFilter(pill.id)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {visibleCourses.length ? (
        <div className="course-list attendance-card-grid">
          {visibleCourses.map((c) => {
            const { percent } = attendancePlan(c.attended, c.total, target);
            const isBelow = percent !== null && percent < target;
            return (
              <button
                type="button"
                className={`course-row attendance-neat-card ${isBelow ? "is-below-target" : ""}`}
                key={courseKey(c)}
                aria-label={`Calculate attendance for ${c.title || c.code}`}
                onClick={() => onOpen(c)}
              >
                <div className="attendance-card-header">
                  <span className="attendance-card-title">
                    {c.title || c.code}
                  </span>
                  <span className="attendance-card-meta">
                    <span className="attendance-code-pill">{c.code}</span>
                    <span className="attendance-type-pill">
                      {c.type || "Course"}
                    </span>
                  </span>
                </div>

                <div className="attendance-card-numbers">
                  <span
                    className={`attendance-percentage-num ${isBelow ? "warning" : ""}`}
                  >
                    {number(percent)}
                    <small>%</small>
                  </span>
                  <span className="attendance-count-num">
                    {c.attended} / {c.total}
                  </span>
                </div>

                <div className="attendance-card-bottom">
                  <span
                    className={`attendance-status-badge ${isBelow ? "warning" : "good"}`}
                  >
                    <Status course={c} target={target} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="attendance-filter-empty">
          <p>
            {filter === "below"
              ? `No courses below ${target}% — you are safe across all subjects!`
              : "No courses match this filter."}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => setFilter("all")}
          >
            Show all courses
          </button>
        </div>
      )}
    </div>
  );
}
export function Marks({ data, newCourseKeys = [] }) {
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
                if (!event.target.closest("summary"))
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
              onChange={(e) => setAttend(Number(e.target.value))}
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
              onChange={(e) => setMiss(Number(e.target.value))}
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
