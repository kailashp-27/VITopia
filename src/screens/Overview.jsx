import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MapPin,
  User,
  X,
} from "lucide-react";
import { Ring } from "../components/Academic.jsx";
import { overallAttendance } from "../calc.js";
import { academicDayStatus, todayISO } from "../calendar-utils.js";
import {
  formatExamType,
  getExamCountdown,
  parseExamDate,
} from "../exam-utils.js";
import {
  weekDates,
  scheduleForDate,
  classTiming,
  shiftDate,
} from "../schedule.js";
import { readFacultyCabins } from "../db.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";

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

function findLiveOrNextClass(timetable, calendar, attendanceMap, now) {
  if (!timetable?.available) return null;
  const today = todayISO();
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

  const formatAttendance = (code) => {
    const course = attendanceMap.get(code);
    let attendancePct = null;
    let isAttendanceWarning = false;
    if (course) {
      if (course.total > 0) {
        const ratio = (course.attended / course.total) * 100;
        attendancePct = ratio.toFixed(1);
        isAttendanceWarning = ratio < 75;
      } else if (Number.isFinite(course.percent)) {
        attendancePct = Number(course.percent).toFixed(1);
        isAttendanceWarning = Number(course.percent) < 75;
      }
    }
    return { attendancePct, isAttendanceWarning };
  };

  const todaySchedule = scheduleForDate(timetable, calendar, today);
  if (!todaySchedule.holiday && todaySchedule.classes?.length) {
    const current = todaySchedule.classes.find(
      (item) => classTiming(item, minutes) === "current",
    );
    if (current) {
      const att = formatAttendance(current.code);
      return {
        item: current,
        isCurrent: true,
        status: "Now",
        dateLabel: "Today",
        isToday: true,
        date: today,
        title:
          attendanceMap.get(current.code)?.title ||
          current.title ||
          current.code,
        code: current.code,
        venue: current.venue || "Room not listed",
        slot: current.slot,
        timing: `${current.start} - ${current.end}`,
        ...att,
      };
    }
    const nextToday = todaySchedule.classes.find(
      (item) => classTiming(item, minutes) === "upcoming",
    );
    if (nextToday) {
      const att = formatAttendance(nextToday.code);
      return {
        item: nextToday,
        isCurrent: false,
        status: "Next",
        dateLabel: "Today",
        isToday: true,
        date: today,
        title:
          attendanceMap.get(nextToday.code)?.title ||
          nextToday.title ||
          nextToday.code,
        code: nextToday.code,
        venue: nextToday.venue || "Room not listed",
        slot: nextToday.slot,
        timing: `${nextToday.start} - ${nextToday.end}`,
        ...att,
      };
    }
  }

  // Look ahead for up to 14 days
  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = shiftDate(today, offset);
    const schedule = scheduleForDate(timetable, calendar, nextDate);
    if (schedule.available && !schedule.holiday && schedule.classes?.length) {
      const firstClass = schedule.classes[0];
      const dateObj = new Date(`${nextDate}T12:00:00Z`);
      const dateLabel = dateObj.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      });
      const att = formatAttendance(firstClass.code);
      return {
        item: firstClass,
        isCurrent: false,
        status: "Next",
        dateLabel,
        isToday: false,
        date: nextDate,
        title:
          attendanceMap.get(firstClass.code)?.title ||
          firstClass.title ||
          firstClass.code,
        code: firstClass.code,
        venue: firstClass.venue || "Room not listed",
        slot: firstClass.slot,
        timing: `${firstClass.start} - ${firstClass.end}`,
        ...att,
      };
    }
  }
  return null;
}

function findNextExam(exams, courses, now) {
  if (!exams?.available || !exams?.items?.length) return null;

  const parsed = exams.items.map((exam) => ({
    ...exam,
    parsedDate: parseExamDate(exam.date, exam.time),
  }));

  const nowMs = now.getTime();
  const futureExams = parsed
    .filter(
      (e) =>
        e.parsedDate && e.parsedDate.getTime() >= nowMs - 3 * 3600 * 1000,
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const targetExam =
    futureExams[0] ||
    parsed.find((e) => e.parsedDate && e.parsedDate.getTime() >= nowMs) ||
    parsed[0];
  if (!targetExam) return null;

  const matches = (courses || []).filter(
    (c) =>
      c.code === targetExam.code ||
      (targetExam.slot &&
        c.slot?.split("+").includes(targetExam.slot.split("+")[0])),
  );
  const title =
    targetExam.title ||
    (matches.length === 1 ? matches[0].title : "") ||
    targetExam.code ||
    "Examination";

  const examType = formatExamType(targetExam.examType);
  const cd = getExamCountdown(targetExam.date, targetExam.time, now);
  const countdown = cd ? (cd.kind === "done" ? "Done" : cd.label) : null;

  return {
    exam: targetExam,
    title,
    examType,
    countdown,
    dateStr: targetExam.date || "Date pending",
    timeStr: targetExam.time || "",
    venue:
      [targetExam.venue, targetExam.location].filter(Boolean).join(" - ") ||
      targetExam.venue ||
      "Venue pending",
    seat: targetExam.seat ? `Seat ${targetExam.seat}` : null,
    slot: targetExam.slot ? `Slot ${targetExam.slot}` : null,
    code: targetExam.code || "",
  };
}

function GlanceWidgets({ data, now, onNavigate, onSelectClass }) {
  const attendanceMap = new Map(
    (data.attendance || []).map((course) => [course.code, course]),
  );
  const liveOrNext = findLiveOrNextClass(
    data.overview?.timetable,
    data.calendar,
    attendanceMap,
    now,
  );
  const nextExam = findNextExam(
    data.overview?.exams,
    data.overview?.courses || data.attendance,
    now,
  );

  const handleClassClick = () => {
    if (liveOrNext?.item) {
      onSelectClass(liveOrNext.item);
    } else {
      onNavigate("profile");
    }
  };

  const examsAvailable = Boolean(data.overview?.exams?.available);

  return (
    <section className="glance-widgets-section" aria-label="Quick glance widgets">
      <div className="glance-widgets-grid">
        {/* Live or Next Class Widget */}
        <div
          className={`glance-widget-card class-widget-card ${liveOrNext?.isCurrent ? "is-live" : ""}`}
          onClick={handleClassClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClassClick();
            }
          }}
          aria-label="Current or next class details"
        >
          <div className="widget-card-top">
            <div className="widget-tag">
              {liveOrNext?.isCurrent ? (
                <span className="live-status-pill">
                  <span className="live-dot" />
                  NOW
                </span>
              ) : (
                <span className="upcoming-status-pill">
                  <Clock3 size={11} />
                  {liveOrNext?.isToday ? "NEXT" : (liveOrNext?.dateLabel || "NEXT")}
                </span>
              )}
            </div>
            {liveOrNext?.attendancePct !== null &&
            liveOrNext?.attendancePct !== undefined ? (
              <span
                className={`widget-attendance-pill ${liveOrNext.isAttendanceWarning ? "warning" : ""}`}
                title={`Attendance: ${liveOrNext.attendancePct}%`}
              >
                {liveOrNext.attendancePct}%
              </span>
            ) : null}
          </div>

          <div className="widget-card-middle">
            <h3
              className="widget-course-title"
              title={liveOrNext?.title || "No class"}
            >
              {liveOrNext?.title ||
                (data.overview?.timetable?.available
                  ? "No upcoming classes"
                  : "Timetable")}
            </h3>
            <span className="widget-course-sub">
              {liveOrNext?.code ? (
                <>
                  {liveOrNext.code}
                  {liveOrNext.slot ? ` · ${liveOrNext.slot}` : ""}
                </>
              ) : liveOrNext ? (
                "Schedule clear"
              ) : data.overview?.timetable?.available ? (
                "Enjoy your break"
              ) : (
                "Sync in Profile"
              )}
            </span>
          </div>

          <div className="widget-card-bottom">
            <div className="widget-meta-row">
              <span
                className="widget-venue"
                title={liveOrNext?.venue || "Venue"}
              >
                <MapPin size={11} />
                <span>{liveOrNext?.venue || "—"}</span>
              </span>
              <span
                className="widget-time"
                title={liveOrNext?.timing || "Time"}
              >
                <Clock3 size={11} />
                <span>{liveOrNext?.timing || "—"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Next Exam Widget */}
        <div
          className="glance-widget-card exam-widget-card"
          onClick={() => onNavigate("exams")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigate("exams");
            }
          }}
          aria-label="Next exam schedule"
        >
          <div className="widget-card-top">
            <div className="widget-tag">
              <span className="exam-status-pill">
                <GraduationCap size={11} />
                {nextExam?.examType || "EXAMS"}
              </span>
            </div>
            {nextExam?.countdown ? (
              <span className="widget-countdown-pill">
                {nextExam.countdown}
              </span>
            ) : null}
          </div>

          <div className="widget-card-middle">
            <h3
              className="widget-course-title"
              title={nextExam?.title || "No exams scheduled"}
            >
              {nextExam?.title ||
                (examsAvailable ? "No exams scheduled" : "Exam schedule")}
            </h3>
            <span className="widget-course-sub">
              {nextExam?.dateStr
                ? `${nextExam.dateStr}${nextExam.timeStr ? ` · ${nextExam.timeStr}` : ""}`
                : examsAvailable
                  ? "You're all clear!"
                  : "Sync in Profile"}
            </span>
          </div>

          <div className="widget-card-bottom">
            <div className="widget-meta-row">
              <span
                className="widget-venue"
                title={nextExam?.venue || "Venue"}
              >
                <MapPin size={11} />
                <span>{nextExam?.venue || "—"}</span>
              </span>
              {nextExam?.seat ? (
                <span
                  className="widget-seat-pill"
                  title={`Seat ${nextExam.seat}`}
                >
                  {nextExam.seat}
                </span>
              ) : (
                <span className="widget-view-arrow">
                  View <ArrowRight size={11} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
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
          <p className="schedule-caption">{schedule.label}</p>
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
        </>
      )}
    </section>
  );
}
export default function Overview({
  data,
  onNavigate,
  timetableWidget = "attendance",
}) {
  const [now, setNow] = useState(() => new Date());
  const [selectedClass, setSelectedClass] = useState(null);
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

      <GlanceWidgets
        data={data}
        now={now}
        onNavigate={onNavigate}
        onSelectClass={setSelectedClass}
      />

      <DailyTimetable
        data={data}
        now={now}
        onSync={() => onNavigate("profile")}
        timetableWidget={timetableWidget}
        onSelectClass={setSelectedClass}
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

      {selectedClass ? (
        <CourseBottomSheet
          item={selectedClass}
          data={data}
          onClose={() => setSelectedClass(null)}
          cabins={cabins}
        />
      ) : null}
    </>
  );
}
