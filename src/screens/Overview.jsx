import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  MapPin,
} from "lucide-react";
import { Ring } from "../components/Academic.jsx";
import { overallAttendance } from "../calc.js";
import { academicDayStatus, todayISO } from "../calendar-utils.js";
import { weekDates, scheduleForDate, classTiming } from "../schedule.js";

function DailyTimetable({ data, onSync, now }) {
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
  const next =
    date === today
      ? schedule.classes.find(
          (item) => classTiming(item, minutes) === "upcoming",
        )
      : null;
  const titles = new Map(
    data.attendance.map((course) => [course.code, course.title]),
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
                  >
                    <div className="class-time">
                      <time>{item.start}</time>
                      <small>{item.end}</small>
                    </div>
                    <div className="class-info">
                      <h3>
                        {titles.get(item.code) || item.title || item.code}
                      </h3>
                      <span>
                        {item.code} · {item.type}
                      </span>
                      <span>
                        <MapPin size={12} />
                        {item.venue || "Room not listed"}
                      </span>
                      {item.faculty ? <small>{item.faculty}</small> : null}
                    </div>
                    {state ? (
                      <span className="class-state">{state}</span>
                    ) : null}
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
      {data.overview?.fetchedAt ? (
        <p className="overview-fetched">
          Details synced{" "}
          {new Date(data.overview.fetchedAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          })}
        </p>
      ) : null}
    </section>
  );
}
export default function Overview({ data, onNavigate }) {
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
