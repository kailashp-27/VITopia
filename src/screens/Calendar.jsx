import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Minus,
  CalendarCheck,
} from "lucide-react";
import {
  monthGrid,
  moveMonth,
  monthLabel,
  todayISO,
  academicDayStatus,
  reminderCountdown,
} from "../calendar-utils.js";
import { addEvent, readEvents, removeEvent } from "../events.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export default function Calendar({ calendar, onSync, demoMode }) {
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState([]);
  const [adding, setAdding] = useState(false);
  useBackOverlay(adding, () => setAdding(false));
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [error, setError] = useState("");
  const reminderTrigger = useRef(null);
  useEffect(() => {
    let active = true;
    if (demoMode) {
      setEvents([]);
      return () => {
        active = false;
      };
    }
    readEvents()
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch(() => {
        if (active) setError("Reminders could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [demoMode]);
  useEffect(() => {
    if (!adding) return;
    const escape = (e) => {
      if (e.key === "Escape") setAdding(false);
      if (e.key === "Tab") {
        const nodes = [
          ...document
            .querySelector(".event-modal")
            .querySelectorAll("button,input"),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (reminderTrigger.current?.isConnected) reminderTrigger.current.focus();
    };
  }, [adding]);
  const reminderDates = new Set(events.map((event) => event.date));
  const academic = new Map(
    (calendar?.days || []).map((day) => [
      day.date,
      { ...day, status: academicDayStatus(day) },
    ]),
  );
  const personal = events.filter((event) => event.date === selected);
  const selectedDay = academic.get(selected);
  function changeMonth(delta) {
    const next = moveMonth(month, delta);
    setMonth(next);
    setSelected(`${next}-01`);
  }
  async function save(event) {
    event.preventDefault();
    if (!title.trim()) return;
    const entry = {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 140),
      date: eventDate,
    };
    try {
      if (!demoMode) await addEvent(entry);
      setEvents((current) => [...current, entry]);
      setSelected(eventDate);
      setMonth(eventDate.slice(0, 7));
      setAdding(false);
      setTitle("");
      setError("");
    } catch {
      setError("The reminder could not be saved on this device.");
    }
  }
  async function erase(id) {
    try {
      if (!demoMode) await removeEvent(id);
      setEvents((current) => current.filter((event) => event.id !== id));
    } catch {
      setError("The reminder could not be removed.");
    }
  }
  return (
    <div className="calendar-screen">
      <section className="calendar-card">
        <div className="calendar-month">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft size={26} />
          </button>
          <h2>{monthLabel(month)}</h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight size={26} />
          </button>
        </div>
        <div className="calendar-week">
          {WEEK.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {monthGrid(month).map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />;
            const day = academic.get(date);
            const status = day?.status || "unknown";
            const hasReminder = reminderDates.has(date);
            return (
              <button
                key={date}
                aria-label={`${date}, ${status === "working" ? "Working day" : status === "holiday" ? "Holiday / no classes" : "Academic status not synced"}${day?.label ? `, ${day.label}` : ""}${hasReminder ? ", Reminder" : ""}`}
                aria-pressed={date === selected}
                aria-current={date === today ? "date" : undefined}
                className={`${status} ${date === selected ? "selected" : ""} ${date === today ? "today" : ""}`}
                onClick={() => setSelected(date)}
              >
                <span>{Number(date.slice(-2))}</span>
                {status === "working" ? (
                  <span className="working-mark" aria-hidden="true" />
                ) : null}
                {hasReminder ? (
                  <Bell
                    className="reminder-mark"
                    size={10}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
      <div className="calendar-legend" aria-label="Calendar legend">
        <span>
          <Minus size={15} /> Working
        </span>
        <span className="holiday-key">Holiday / no classes</span>
        <span>
          <Bell size={12} /> Reminder
        </span>
      </div>
      <button
        className="add-event"
        ref={reminderTrigger}
        onClick={() => {
          setEventDate(selected);
          setAdding(true);
        }}
      >
        <Plus size={17} />
        Add Reminder
      </button>
      {!calendar ? (
        <div className="calendar-source">
          <span>Academic calendar not synced.</span>
          <button className="text-button" onClick={onSync}>
            Sync from Profile
          </button>
        </div>
      ) : (
        <div className="calendar-source">
          <span>{demoMode ? "Sample calendar" : "VTOP academic calendar"}</span>
          <span>
            {demoMode
              ? "Preview only"
              : calendar.months?.includes(month)
                ? "Saved on device"
                : "No VTOP dates for this month"}
          </span>
        </div>
      )}
      {selectedDay || personal.length ? (
        <section className="calendar-day-details">
          <h3>
            {new Date(`${selected}T12:00:00Z`).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
            })}
          </h3>
          {selectedDay ? (
            <div>
              <CalendarCheck
                size={17}
                className="day-detail-icon"
                aria-hidden="true"
              />
              <p>
                <strong>
                  {selectedDay.status === "working"
                    ? "Working day"
                    : selectedDay.status === "holiday"
                      ? "Holiday / no classes"
                      : "Academic status unavailable"}
                </strong>
                {selectedDay.label ? <small>{selectedDay.label}</small> : null}
                {selectedDay.conflict ||
                (selectedDay.instructional === true &&
                  selectedDay.status === "holiday") ? (
                  <small className="warning">
                    VTOP’s labels conflict; holiday wording takes priority.
                  </small>
                ) : null}
                {selectedDay.status === "working" && selectedDay.dayOrder ? (
                  <small>{selectedDay.dayOrder} day order</small>
                ) : null}
                <small>
                  {demoMode
                    ? "Sample academic calendar"
                    : "VTOP academic calendar"}
                </small>
              </p>
            </div>
          ) : null}
          {personal.map((event) => (
            <div key={event.id}>
              <Bell size={16} className="day-detail-icon" aria-hidden="true" />
              <p>
                <strong>{event.title}</strong>
                <small>Reminder · {reminderCountdown(event.date, today)}</small>
              </p>
              <button
                className="icon-button"
                aria-label={`Delete reminder ${event.title}`}
                onClick={() => erase(event.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      ) : null}
      {error ? (
        <p className="form-message error" role="alert">
          {error}
        </p>
      ) : null}
      {adding ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAdding(false);
          }}
        >
          <form
            className="event-modal"
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-title"
          >
            <button
              className="icon-button close-button"
              type="button"
              aria-label="Close reminder form"
              onClick={() => setAdding(false)}
            >
              <X size={20} />
            </button>
            <h2 id="event-title">Add Reminder</h2>
            <p className="reminder-note">
              {demoMode
                ? "Demo reminder; not saved on your device."
                : "Saved on this device. Reminders do not change working days or attendance."}
            </p>
            <label>
              Title
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </label>
            <button className="button primary full-width">Save reminder</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
