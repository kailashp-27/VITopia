import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Hand } from "lucide-react";
import {
  buildAttendanceMatrix,
  courseStatusSummary,
} from "../attendance-matrix.js";
import { triggerLightHaptic } from "../native-bridge.js";

const courseKey = (c) => `${c.code}-${c.type || ""}-${c.slot || ""}`;
const fmtPct = (v) => (v === null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`);

export default function AttendanceMatrix({ data }) {
  const courses = data?.attendance || [];
  const [selectedKey, setSelectedKey] = useState(() =>
    courses[0] ? courseKey(courses[0]) : "",
  );
  const [activeCell, setActiveCell] = useState(null);

  useEffect(() => {
    if (!courses.length) {
      setSelectedKey("");
      return;
    }
    if (!courses.some((c) => courseKey(c) === selectedKey)) {
      setSelectedKey(courseKey(courses[0]));
      setActiveCell(null);
    }
  }, [courses, selectedKey]);

  if (!courses.length) {
    return (
      <div className="empty-inline">
        No attendance data available yet. Sync your account to use Attendance Matrix.
      </div>
    );
  }

  const course =
    courses.find((c) => courseKey(c) === selectedKey) || courses[0];
  const summary = courseStatusSummary(course, 75);
  const rows = buildAttendanceMatrix(course, {
    maxAttend: 5,
    maxMiss: 5,
    target: 75,
  });

  const selectedProjection = activeCell
    ? rows[activeCell.miss]?.cells[activeCell.attend] || null
    : null;

  const diff =
    selectedProjection &&
    summary.percent !== null &&
    selectedProjection.percent !== null
      ? selectedProjection.percent - summary.percent
      : null;

  return (
    <div className="matrix-screen">
      <section className="matrix-card" aria-label="Course selection">
        <div className="matrix-card-head">
          <span className="matrix-head-icon" aria-hidden="true">
            <BookOpen size={16} />
          </span>
          <div>
            <h2>Course selection</h2>
            <p>Track individual course attendance</p>
          </div>
        </div>

        <div className="matrix-select-wrap">
          <select
            aria-label="Choose a course"
            className="matrix-course-select"
            value={courseKey(course)}
            onChange={(e) => {
              void triggerLightHaptic();
              setSelectedKey(e.target.value);
              setActiveCell(null);
            }}
          >
            {courses.map((c) => (
              <option key={courseKey(c)} value={courseKey(c)}>
                {c.code} — {c.title || c.code}
                {c.type ? ` (${c.type})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="matrix-select-chevron"
            aria-hidden="true"
          />
        </div>

        <div className="matrix-stats-block">
          <span className="matrix-stats-label">Course statistics</span>
          <div className="matrix-stats-row">
            <div className="matrix-stats-numbers">
              <div className="matrix-stats-pct-line">
                <strong className={`matrix-big-pct tier-${summary.tier}`}>
                  {fmtPct(summary.percent)}
                </strong>
                <span className={`matrix-margin-val tier-${summary.tier}`}>
                  {summary.marginLabel}
                </span>
              </div>
              <span className="matrix-classes-ratio">
                {summary.attended} / {summary.total} classes
              </span>
            </div>
            <span className={`matrix-status-box tier-${summary.tier}`}>
              {summary.statusLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="matrix-card" aria-label="Attendance projection matrix">
        <div className="matrix-grid-top">
          <span className="matrix-axis-title">Absent ↓ / Attend →</span>
          <span className="matrix-now-legend">
            <span className="matrix-now-chip">Now</span>
            <span>= Current</span>
          </span>
        </div>

        <div className="matrix-table-wrap">
          <div className="matrix-grid" role="grid" aria-label="Attend versus absent projection grid">
            <div className="matrix-corner" aria-hidden="true" />
            {[0, 1, 2, 3, 4, 5].map((attend) => (
              <div key={`col-${attend}`} className="matrix-col-head">
                +{attend}
              </div>
            ))}

            {rows.map((row) => (
              <div key={`row-${row.miss}`} className="matrix-row-group" role="row">
                <div className="matrix-row-head">+{row.miss}</div>
                {row.cells.map((cell) => {
                  const isSelected =
                    activeCell &&
                    activeCell.miss === cell.miss &&
                    activeCell.attend === cell.attend;
                  return (
                    <button
                      key={`${cell.miss}-${cell.attend}`}
                      type="button"
                      role="gridcell"
                      aria-pressed={Boolean(isSelected)}
                      aria-label={`Attend +${cell.attend}, absent +${cell.miss}: ${fmtPct(cell.percent)}, margin ${cell.marginLabel}`}
                      className={`matrix-cell tier-${cell.tier} ${cell.isCurrent ? "is-current" : ""} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        void triggerLightHaptic();
                        setActiveCell({ miss: cell.miss, attend: cell.attend });
                      }}
                    >
                      {cell.isCurrent ? (
                        <span className="matrix-cell-now">Now</span>
                      ) : null}
                      <span className="matrix-cell-pct">
                        {fmtPct(cell.percent)}
                      </span>
                      <span className="matrix-cell-margin">
                        {cell.marginLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedProjection ? (
          <div className="matrix-detail-bar" role="status" aria-live="polite">
            <div className="matrix-detail-top">
              <span className="matrix-detail-scenario">
                {selectedProjection.isCurrent
                  ? "Current attendance"
                  : `Attend +${selectedProjection.attend} · Absent +${selectedProjection.miss}`}
              </span>
              <span
                className={`matrix-detail-delta ${diff === null || Math.abs(diff) < 0.05 ? "neutral" : diff > 0 ? "up" : "down"}`}
              >
                {diff === null || Math.abs(diff) < 0.05
                  ? "0.0%"
                  : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
              </span>
            </div>
            <div className="matrix-detail-main">
              <strong className={`tier-${selectedProjection.tier}`}>
                {fmtPct(selectedProjection.percent)}
              </strong>
              <span>
                {selectedProjection.attended} / {selectedProjection.total} classes
              </span>
            </div>
            <p className="matrix-detail-advice">
              {selectedProjection.plan.attend > 0
                ? `Need to attend next ${selectedProjection.plan.attend} ${selectedProjection.plan.attend === 1 ? "class" : "classes"} to reach 75%`
                : selectedProjection.plan.skip > 0
                  ? `Can skip ${selectedProjection.plan.skip} ${selectedProjection.plan.skip === 1 ? "class" : "classes"} and stay at 75%+`
                  : "Right on the 75% margin — no classes to skip"}
            </p>
          </div>
        ) : (
          <div className="matrix-tap-hint">
            <Hand size={14} aria-hidden="true" />
            <span>Tap any cell for detailed projection</span>
          </div>
        )}
      </section>
    </div>
  );
}
