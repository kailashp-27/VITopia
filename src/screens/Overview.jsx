import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  MapPin,
  User,
  X,
} from "lucide-react";
import { Ring } from "../components/Academic.jsx";
import { overallAttendance } from "../calc.js";
import { academicDayStatus, todayISO } from "../calendar-utils.js";
import {
  weekDates,
  scheduleForDate,
  classTiming,
  shiftDate,
} from "../schedule.js";
import { readFacultyCabins } from "../db.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
import { collectOdItems } from "../attendance-history.js";
import { triggerLightHaptic } from "../native-bridge.js";

function renderTimetableWidget(item, widgetType, attendanceMap) {
  if (widgetType === "none") return null;
  if (widgetType === "attendance") {
    const course = attendanceMap.get(item.code);
    let pct = "—";
    let statusClass = "good";
    if (course && course.total > 0) {
      const numPct = (course.attended / course.total) * 100;
      pct = `${numPct.toFixed(1)}%`;
      if (numPct < 75) {
        statusClass = "danger";
      } else if (numPct <= 80) {
        statusClass = "warning";
      } else {
        statusClass = "good";
      }
    } else if (course && Number.isFinite(course.percent)) {
      const numPct = Number(course.percent);
      pct = `${numPct.toFixed(1)}%`;
      if (numPct < 75) {
        statusClass = "danger";
      } else if (numPct <= 80) {
        statusClass = "warning";
      } else {
        statusClass = "good";
      }
    }
    return (
      <span
        className={`class-widget attendance-widget ${statusClass}`}
        title={
          course
            ? `${course.attended}/${course.total} attended (${pct})`
            : "Attendance not available"
        }
      >
        {pct}
      </span>
    );
  }
  if (widgetType === "venue") {
    return (
      <span
        className="class-widget venue-widget"
        title={item.venue || "Room not listed"}
      >
        <MapPin size={11} />
        <span>{item.venue || "Room not listed"}</span>
      </span>
    );
  }
  if (widgetType === "slot") {
    return (
      <span
        className="class-widget slot-widget"
        title={item.slot || "Slot not listed"}
      >
        {item.slot || "—"}
      </span>
    );
  }
  return null;
}

function CourseBottomSheet({ item, data, onClose, cabins = {} }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const course = (data.attendance || []).find((c) => c.code === item.code);
  const titles = new Map(
    (data.attendance || []).map((c) => [c.code, c.title]),
  );
  const title = titles.get(item.code) || item.title || item.code;
  const faculty = item.faculty || course?.faculty;
  const cabin = cabins[faculty] || item.cabin || course?.cabin;
  const percent = course ? course.percent : null;
  const isWarning = percent !== null && percent < 75;

  return (
    <div
      className="course-sheet-portal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="course-bottom-sheet">
        <div className="sheet-handle-bar">
          <span className="sheet-handle" />
        </div>
        <div className="sheet-header">
          <div className="sheet-title-group">
            <h2>{title}</h2>
            <span className="sheet-subtitle">
              {item.code} · {item.type}
            </span>
          </div>
          <button
            type="button"
            className="icon-button sheet-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="sheet-attendance-card">
            <div className="sheet-ring-wrapper">
              <Ring percent={percent} size={95} label="Attendance" />
            </div>
            <div className="sheet-attendance-info">
              {course ? (
                <>
                  <div className="sheet-attendance-ratio">
                    <strong>{course.attended}</strong> / {course.total} classes
                    attended
                  </div>
                  <span
                    className={`sheet-status-tag ${isWarning ? "warning" : "good"}`}
                  >
                    {isWarning ? "Below 75% threshold" : "Above 75% threshold"}
                  </span>
                </>
              ) : (
                <div className="sheet-attendance-ratio">
                  Attendance data not available for this course.
                </div>
              )}
            </div>
          </div>

          <div className="sheet-details-grid">
            <div className="sheet-detail-item">
              <div className="sheet-detail-icon">
                <Clock3 size={15} />
              </div>
              <div className="sheet-detail-text">
                <small>Timing & Slot</small>
                <strong>
                  {item.start} – {item.end}
                  {item.slot ? ` · ${item.slot}` : ""}
                </strong>
              </div>
            </div>

            <div className="sheet-detail-item">
              <div className="sheet-detail-icon">
                <MapPin size={15} />
              </div>
              <div className="sheet-detail-text">
                <small>Place / Venue</small>
                <strong>{item.venue || "Room not listed"}</strong>
              </div>
            </div>

            {faculty ? (
              <div className="sheet-detail-item sheet-detail-full">
                <div className="sheet-detail-icon">
                  <User size={15} />
                </div>
                <div className="sheet-detail-text">
                  <small>Faculty</small>
                  <strong>{faculty}</strong>
                  {cabin ? (
                    <span className="sheet-cabin-badge">Cabin: {cabin}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function getHolidayOasisData(
  date,
  schedule,
  calendar,
  timetable,
  now,
  profileName,
) {
  const academic = calendar?.days?.find((d) => d.date === date);
  const holidayReason =
    academic?.label || schedule?.label || "Holiday / No classes";

  const rawName = (profileName || "").trim();
  const firstName = rawName ? rawName.split(/\s+/)[0] : "";
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : "";

  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let reopenHours = null;
  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = shiftDate(date, offset);
    const sched = scheduleForDate(timetable, calendar, nextDate);
    const nextAcademic = calendar?.days?.find((d) => d.date === nextDate);
    const status = academicDayStatus(nextAcademic);
    if (!sched.holiday && (sched.classes?.length > 0 || status === "working")) {
      const [y, m, d] = nextDate.split("-").map(Number);
      const reopenDate = new Date(y, m - 1, d, 8, 0, 0);
      const diffMs = reopenDate.getTime() - now.getTime();
      reopenHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      break;
    }
  }
  if (!reopenHours) reopenHours = 48;

  return {
    displayName,
    isWeekend,
    holidayReason,
    reopenHours,
  };
}

function DailyTimetable({
  data,
  onSync,
  now,
  timetableWidget = "attendance",
  onSelectClass,
}) {
  const today = todayISO();
  const [chosen, setChosen] = useState(null);
  const date = chosen || today;
  const timetable = data.overview?.timetable;
  const week = weekDates(today).filter(
    ({ day, date: itemDate }, i) =>
      i < 5 ||
      itemDate === today ||
      timetable?.classes?.some((item) => item.day === day) ||
      academicDayStatus(
        data.calendar?.days?.find((item) => item.date === itemDate),
      ) === "working",
  );
  const schedule = scheduleForDate(timetable, data.calendar, date);
  const minutes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number)
    .reduce((sum, n, i) => sum + n * (i ? 1 : 60), 0);
  const titles = new Map(
    data.attendance.map((course) => [course.code, course.title]),
  );
  const attendanceMap = new Map(
    (data.attendance || []).map((course) => [course.code, course]),
  );
  return (
    <section className="daily-timetable">
      <div className="section-heading">
        <h2>{date === today ? "Today’s timetable" : "Timetable"}</h2>
        <time dateTime={date}>
          {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Kolkata",
          })}
        </time>
      </div>
      <div className="weekday-tabs" role="group" aria-label="Timetable day">
        {week.map((item) => (
          <button
            type="button"
            key={item.date}
            aria-pressed={item.date === date}
            aria-label={`${item.day}, ${item.date}`}
            onClick={() => setChosen(item.date === today ? null : item.date)}
          >
            <span>
              {item.day.slice(0, 1) + item.day.slice(1).toLowerCase()}
            </span>
            <small>{Number(item.date.slice(-2))}</small>
          </button>
        ))}
      </div>
      {!schedule.available ? (
        <div className="schedule-empty">
          <Clock3 size={22} />
          <p>Timetable not available yet.</p>
          <button className="text-button" onClick={onSync}>
            Sync from Profile <ArrowRight size={14} />
          </button>
        </div>
      ) : schedule.holiday || !schedule.classes.length ? (
        (() => {
          const oasis = getHolidayOasisData(
            date,
            schedule,
            data.calendar,
            data.overview?.timetable,
            now,
            data.overview?.profile?.name ||
              data.profile?.name ||
              data.student?.name,
          );
          return (
            <div className="holiday-oasis-card">
              <h3 className="holiday-greeting-text">
                {oasis.displayName
                  ? `Enjoy your holidays, ${oasis.displayName}!`
                  : "Enjoy your holidays!"}{" "}
                Campus reopens in <strong>{oasis.reopenHours}h</strong>.
              </h3>
            </div>
          );
        })()
      ) : (
        <>
          {schedule.label ? (
            <p className="schedule-caption">{schedule.label}</p>
          ) : null}
          <div className="daily-classes">
            {schedule.classes.map((item) => {
              const timing =
                date === today ? classTiming(item, minutes) : "upcoming";
              const isCurrent = date === today && timing === "current";
              return (
                <article
                  key={`${item.code}-${item.start}-${item.type}`}
                  className={`daily-class ${date === today ? timing : ""} ${isCurrent ? "highlighted is-current" : ""}`}
                  onClick={() => onSelectClass(item)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${titles.get(item.code) || item.title || item.code}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectClass(item);
                    }
                  }}
                >
                  <div className="class-time">
                    <time>{item.start}</time>
                    <small>{item.end}</small>
                  </div>
                  <div className="class-info">
                    <h3
                      title={
                        titles.get(item.code) || item.title || item.code
                      }
                    >
                      {titles.get(item.code) || item.title || item.code}
                    </h3>
                  </div>
                  <div className="class-right">
                    {renderTimetableWidget(
                      item,
                      timetableWidget,
                      attendanceMap,
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
function OdDetailsModal({ open, data, onClose }) {
  useBackOverlay(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const ods = data?.overview?.ods;
  const limit = Number.isFinite(ods?.limit) ? ods.limit : 40;
  const hours = Number.isFinite(ods?.hours) ? ods.hours : null;
  const items = collectOdItems(data);
  const ratioPct =
    hours !== null && limit > 0 ? Math.min(100, (hours / limit) * 100) : 0;
  const isOverLimit = hours !== null && hours > limit;

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
        aria-labelledby="od-details-heading"
        className="attendance-history-modal od-details-modal"
      >
        <div className="attendance-history-header">
          <div className="attendance-history-heading-group">
            <h2 id="od-details-heading">On-Duty (OD) Details</h2>
            <div className="attendance-history-submeta">
              <span
                className={`attendance-history-pct ${isOverLimit ? "danger" : "good"}`}
              >
                {hours !== null ? `${hours} / ${limit}` : "—"}
              </span>
              <span className="attendance-history-ratio">
                {hours !== null
                  ? isOverLimit
                    ? `${hours - limit}h over semester limit`
                    : `${Math.max(0, limit - hours)}h remaining`
                  : "class hours"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button attendance-history-close"
            aria-label="Close OD details"
            onClick={onClose}
            autoFocus
          >
            <X size={18} />
          </button>
        </div>

        {hours !== null ? (
          <div className="od-progress-wrap">
            <div className="od-progress-track" aria-hidden="true">
              <div
                className={`od-progress-fill ${isOverLimit ? "danger" : ""}`}
                style={{ width: `${ratioPct}%` }}
              />
            </div>
            <div className="od-progress-meta">
              <span>
                {items.length} {items.length === 1 ? "session" : "sessions"}
              </span>
              <span>Limit: {limit} class hours</span>
            </div>
          </div>
        ) : null}

        {items.length ? (
          <div className="attendance-history-list" role="list">
            {items.map((item, idx) => {
              const metaParts = [
                item.date || "",
                item.slot || "",
                item.timing || "",
              ].filter(Boolean);
              const hrs = Number(item.hours) || 1;
              return (
                <div
                  key={`${item.courseCode}-${item.date}-${item.slot}-${idx}`}
                  className="attendance-history-row od-entry-row"
                  role="listitem"
                >
                  <div className="history-row-left">
                    <span className="history-row-date">
                      {item.courseTitle || item.courseCode || "On-Duty Class"}
                    </span>
                    {metaParts.length ? (
                      <span className="history-row-meta">
                        {metaParts.join(" · ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="od-row-right">
                    <span className="history-status-chip od">
                      {hrs} {hrs === 1 ? "hr" : "hrs"}
                    </span>
                    {item.status &&
                    !/^(?:on[ -]?duty|od)$/i.test(item.status) ? (
                      <span className="od-status-note">{item.status}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="attendance-history-empty">
            <CalendarCheck size={22} />
            <p>
              {ods?.available
                ? hours === 0
                  ? "No On-Duty (OD) classes recorded this semester yet."
                  : "OD entries haven't been synced yet. Sync again to load the full OD list from VTOP."
                : "OD details are unavailable right now. Sync your VTOP account to fetch OD records."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Overview({
  data,
  onNavigate,
  timetableWidget = "attendance",
}) {
  const [now, setNow] = useState(() => new Date());
  const [selectedClass, setSelectedClass] = useState(null);
  const [odModalOpen, setOdModalOpen] = useState(false);
  const [cabins, setCabins] = useState({});

  useBackOverlay(Boolean(selectedClass), () => setSelectedClass(null));

  useEffect(() => {
    let active = true;
    readFacultyCabins()
      .then((records) => {
        if (active && records) setCabins(records);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const overall = overallAttendance(data.attendance);
  const ods = data.overview?.ods;
  const feedback = data.overview?.feedback;
  const feedbackLabel = !feedback?.available
    ? "Not available"
    : {
        submitted: "Submitted",
        pending: "Pending",
        "not-open": "Not open",
        unknown: "Partly available",
      }[feedback.status] || "Not available";

  return (
    <>
      <div className="summary-grid">
        <section className="summary-card attendance-summary">
          <div>
            <h2>Overall attendance</h2>
            <span className="summary-foot">
              {overall.attended} / {overall.total} classes
            </span>
          </div>
          <Ring percent={overall.percent} />
        </section>
      </div>

      <DailyTimetable
        data={data}
        now={now}
        onSync={() => onNavigate("profile")}
        timetableWidget={timetableWidget}
        onSelectClass={setSelectedClass}
      />

      <div className="summary-grid overview-details">
        <section
          className="summary-card compact-summary overview-stat is-interactive"
          role="button"
          tabIndex={0}
          aria-label="View On-Duty (OD) hours list"
          onClick={() => {
            void triggerLightHaptic();
            setOdModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void triggerLightHaptic();
              setOdModalOpen(true);
            }
          }}
        >
          <CalendarCheck size={20} />
          <h2>OD hours</h2>
          <strong
            className={`metric-number ${!Number.isFinite(ods?.hours) ? "metric-unavailable" : ""} ${ods?.hours > 40 ? "warning" : ""}`}
          >
            {ods?.available && Number.isFinite(ods.hours)
              ? `${ods.hours}/40`
              : "Not available"}
          </strong>
          <small>
            {ods?.available && Number.isFinite(ods.hours)
              ? ods.hours > 40
                ? `${ods.hours - 40} hours above limit · Tap for list`
                : "Tap to view OD list"
              : data.overview
                ? "Unavailable from VTOP"
                : "Check after your next sync"}
          </small>
        </section>
        <section className="summary-card compact-summary overview-stat">
          <ClipboardCheck size={20} />
          <h2>Course feedback</h2>
          <strong className="metric-number metric-status">
            {feedbackLabel}
          </strong>
          <small>
            {feedback?.available && feedback.total
              ? `${feedback.submitted} / ${feedback.total} submitted`
              : feedback?.status === "not-open"
                ? "VTOP feedback window closed"
                : "Current semester status"}
          </small>
        </section>
      </div>

      {selectedClass ? (
        <CourseBottomSheet
          item={selectedClass}
          data={data}
          onClose={() => setSelectedClass(null)}
          cabins={cabins}
        />
      ) : null}

      <OdDetailsModal
        open={odModalOpen}
        data={data}
        onClose={() => setOdModalOpen(false)}
      />
    </>
  );
}
