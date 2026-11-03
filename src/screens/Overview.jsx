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
import { weekDates, scheduleForDate, classTiming } from "../schedule.js";
import { readFacultyCabins } from "../db.js";

function renderTimetableWidget(item, widgetType, attendanceMap) {
  if (widgetType === "none") return null;
  if (widgetType === "attendance") {
    const course = attendanceMap.get(item.code);
    let pct = "—";
    let isWarning = false;
    if (course && course.total > 0) {
      const ratio = course.attended / course.total;
      pct = `${(ratio * 100).toFixed(1)}%`;
      isWarning = ratio < 0.75;
    } else if (course && Number.isFinite(course.percent)) {
      pct = `${Number(course.percent).toFixed(1)}%`;
      isWarning = Number(course.percent) < 75;
    }
    return (
      <span
        className={`class-widget attendance-widget ${isWarning ? "warning" : ""}`}
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

function DailyTimetable({ data, onSync, now, timetableWidget = "attendance" }) {
  const today = todayISO();
  const [chosen, setChosen] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [cabins, setCabins] = useState({});

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
  const next =
    date === today
      ? schedule.classes.find(
          (item) => classTiming(item, minutes) === "upcoming",
        )
      : null;
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
      ) : schedule.holiday ? (
        <div className="schedule-empty">
          <CalendarCheck size={22} />
          <p>{schedule.label}</p>
          <small>Holiday / no classes</small>
        </div>
      ) : (
        <>
          <p className="schedule-caption">{schedule.label}</p>
          {schedule.classes.length ? (
            <div className="daily-classes">
              {schedule.classes.map((item) => {
                const timing =
                  date === today ? classTiming(item, minutes) : "upcoming";
                const state =
                  timing === "current" ? "Now" : item === next ? "Next" : null;
                return (
                  <article
                    key={`${item.code}-${item.start}-${item.type}`}
                    className={`daily-class ${date === today ? timing : ""} ${state ? "highlighted" : ""}`}
                    onClick={() => setSelectedClass(item)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${titles.get(item.code) || item.title || item.code}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedClass(item);
                      }
                    }}
                  >
                    <div className="class-time">
                      <time>{item.start}</time>
                      <small>{item.end}</small>
                    </div>
                    <div className="class-info">
                      <h3 title={titles.get(item.code) || item.title || item.code}>
                        {titles.get(item.code) || item.title || item.code}
                      </h3>
                    </div>
                    <div className="class-right">
                      {state ? (
                        <span className="class-state">{state}</span>
                      ) : null}
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
          ) : (
            <p className="empty-inline">
              No classes scheduled for this day order.
            </p>
          )}
        </>
      )}
      {selectedClass ? (
        <CourseBottomSheet
          item={selectedClass}
          data={data}
          onClose={() => setSelectedClass(null)}
          cabins={cabins}
        />
      ) : null}
    </section>
  );
}
export default function Overview({
  data,
  onNavigate,
  timetableWidget = "attendance",
}) {
  const [now, setNow] = useState(() => new Date());
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
      />
      <div className="summary-grid overview-details">
        <section className="summary-card compact-summary overview-stat">
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
                ? `${ods.hours - 40} hours above the limit`
                : "Semester limit: 40 class hours"
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
    </>
  );
}
