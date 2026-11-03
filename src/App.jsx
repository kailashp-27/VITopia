import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Download,
  Home,
  LoaderCircle,
  RefreshCw,
  Settings,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import Sync from "./screens/Sync.jsx";
import ProfileDetails from "./screens/Profile.jsx";
import Overview from "./screens/Overview.jsx";
import Calendar from "./screens/Calendar.jsx";
import Simulator from "./screens/Simulator.jsx";
import HostelLeave from "./screens/HostelLeave.jsx";
import { Calculator, CourseTable, Marks } from "./components/Academic.jsx";
import { clearLogin } from "./credentials.js";
import { clearEvents } from "./events.js";
import { clearCache, readCache, saveCache } from "./db.js";
import { fetchCalendar } from "./api-client.js";
import { demo } from "./demo.js";
import { unreadMarksCourses } from "./marks-updates.js";
const NAV = [
  { id: "overview", label: "Home", title: "Overview", icon: Home },
  {
    id: "attendance",
    label: "Attendance",
    title: "Attendance",
    icon: BarChart3,
  },
  { id: "calendar", label: "Calendar", title: "Calendar", icon: CalendarDays },
  { id: "marks", label: "Marks", title: "Marks", icon: BookOpen },
  { id: "profile", label: "Profile", title: "Profile", icon: UserRound },
];
function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
export default function App() {
  const [screen, setScreen] = useState("overview");
  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  const [demoMode, setDemoMode] = useState(false);
  const [marksHighlights, setMarksHighlights] = useState([]);
  const [ready, setReady] = useState(false);
  const [course, setCourse] = useState(null);
  const calculatorTrigger = useRef(null);
  function openCalculator(value) {
    calculatorTrigger.current = document.activeElement;
    setCourse(value);
  }
  const [notice, setNotice] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const calendarAbort = useRef(null);
  const online = useOnline();
  const [timetableWidget, setTimetableWidget] = useState(() => {
    try {
      return localStorage.getItem("vtopia_timetable_widget") || "attendance";
    } catch {
      return "attendance";
    }
  });
  const handleWidgetChange = (widget) => {
    setTimetableWidget(widget);
    try {
      localStorage.setItem("vtopia_timetable_widget", widget);
    } catch {}
  };
  const profilePages = [
    "profile",
    "settings",
    "courses",
    "exams",
    "simulator",
    "hostel-leave",
    "widget-customization",
  ];
  const currentPage =
    {
      settings: { title: "Settings" },
      courses: { title: "Course list" },
      exams: { title: "Exam schedule" },
      simulator: { title: "Attendance Simulator" },
      "hostel-leave": { title: "Hostel leave" },
      "widget-customization": { title: "Widget customization" },
    }[screen] || NAV.find((page) => page.id === screen);
  useEffect(() => {
    document.title = `${currentPage.title} · Vtopia`;
  }, [currentPage.title]);
  useEffect(() => {
    let active = true;
    readCache()
      .then((cached) => {
        if (
          active &&
          cached?.version === 1 &&
          Array.isArray(cached.attendance) &&
          Array.isArray(cached.marks)
        ) {
          dataRef.current = cached;
          setData(cached);
        }
      })
      .catch(() => {
        if (active) setNotice("Device storage is unavailable.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      calendarAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    if (screen !== "marks" || demoMode) {
      setMarksHighlights([]);
      return;
    }
    const current = dataRef.current;
    if (!current?.unreadMarks?.length) return;
    setMarksHighlights(current.unreadMarks);
    const next = { ...current, unreadMarks: [] };
    dataRef.current = next;
    setData(next);
    saveCache(next).catch(() =>
      setNotice("Marks viewed, but the notification could not be saved."),
    );
  }, [screen, demoMode, data?.unreadMarks]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() =>
        setNotice("Offline installation is unavailable in this browser."),
      );
  }, []);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    if (!course) return;
    const escape = (e) => {
      if (e.key === "Escape") setCourse(null);
      if (e.key === "Tab") {
        const elements = [
          ...document
            .querySelector('[role="dialog"]')
            .querySelectorAll("button,input"),
        ];
        const first = elements[0],
          last = elements.at(-1);
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
      calculatorTrigger.current?.focus();
    };
  }, [course]);
  async function receiveData(snapshot) {
    const previous = dataRef.current;
    const next = {
      ...snapshot,
      unreadMarks: unreadMarksCourses(previous, snapshot),
      ...(!snapshot.overview &&
      previous?.semester?.id === snapshot.semester?.id &&
      previous.overview
        ? { overview: previous.overview }
        : {}),
      ...(!snapshot.calendar &&
      previous?.semester?.id === snapshot.semester?.id &&
      previous.calendar
        ? { calendar: previous.calendar }
        : {}),
    };
    dataRef.current = next;
    setData(next);
    setDemoMode(false);
    try {
      await saveCache(next);
      setNotice("");
    } catch {
      setNotice("Synced, but offline data could not be saved.");
    }
  }
  async function receiveOverview(overview, semesterId) {
    const current = dataRef.current;
    if (!current || current.semester?.id !== semesterId) return;
    const next = { ...current, overview };
    dataRef.current = next;
    setData(next);
    try {
      await saveCache(next);
    } catch {
      setNotice("Overview fetched, but could not be saved offline.");
    }
  }
  async function receiveCalendar(calendar, semesterId) {
    const current = dataRef.current;
    if (!current || current.semester?.id !== semesterId) return;
    const next = { ...current, calendar };
    dataRef.current = next;
    setData(next);
    try {
      await saveCache(next);
    } catch {
      setNotice("Calendar fetched, but could not be saved offline.");
    }
  }
  async function receiveHostelLeave(leave, syncedAt) {
    const current = dataRef.current;
    if (!current || current.syncedAt !== syncedAt) return;
    const merged = { ...leave };
    for (const kind of ["status", "history"]) {
      if (!leave[kind].available && current.hostelLeave?.[kind]?.available)
        merged[kind] = {
          ...current.hostelLeave[kind],
          stale: true,
          message: leave[kind].message,
        };
    }
    const next = { ...current, hostelLeave: merged };
    dataRef.current = next;
    setData(next);
    try {
      await saveCache(next);
    } catch {
      setNotice("Leave fetched, but could not be saved on this device.");
    }
  }
  async function refreshCalendar() {
    if (calendarBusy) return;
    if (!online) {
      setNotice("Connect to the internet to refresh the calendar.");
      return;
    }
    if (demoMode || !sessionToken || !data?.semester?.id) {
      setNotice("Sync in Profile to fetch the VTOP academic calendar.");
      return;
    }
    const controller = new AbortController();
    calendarAbort.current = controller;
    setCalendarBusy(true);
    setNotice("");
    try {
      const calendar = await fetchCalendar(
        sessionToken,
        data.semester.id,
        AbortSignal.any([controller.signal, AbortSignal.timeout(110000)]),
      );
      await receiveCalendar(calendar, data.semester.id);
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(error.message || "Academic calendar could not be fetched.");
    } finally {
      if (!controller.signal.aborted) setCalendarBusy(false);
    }
  }
  function explore() {
    setData(demo);
    setDemoMode(true);
    setScreen("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function leaveDemo() {
    setDemoMode(false);
    setData(dataRef.current);
    setScreen("profile");
  }
  async function forget() {
    try {
      await Promise.all([clearCache(), clearLogin(), clearEvents()]);
      dataRef.current = null;
      setData(null);
      setDemoMode(false);
      setSessionToken(null);
      setScreen("overview");
      setNotice("Device data cleared.");
    } catch {
      setNotice("Could not clear all device data.");
    }
  }
  function refresh() {
    if (screen === "calendar") void refreshCalendar();
    else setScreen("profile");
  }
  return (
    <div className="app-shell compact-app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="page-title">
          {[
            "settings",
            "courses",
            "exams",
            "simulator",
            "hostel-leave",
            "widget-customization",
          ].includes(screen) ? (
            <button
              type="button"
              className="header-icon"
              aria-label="Back to Profile"
              onClick={() => setScreen("profile")}
            >
              <ArrowLeft size={21} />
            </button>
          ) : null}
          <h1>{currentPage.title}</h1>
        </div>
        <div className="header-actions">
          {!online ? (
            <span className="offline-tag">
              <WifiOff size={15} />
              <span className="sr-only">Offline</span>
            </span>
          ) : null}
          {screen !== "settings" ? (
            <>
              <button
                className="header-icon"
                aria-label={
                  screen === "calendar"
                    ? "Refresh academic calendar"
                    : "Sync account"
                }
                onClick={refresh}
                disabled={calendarBusy}
              >
                {calendarBusy ? (
                  <LoaderCircle className="spinning" size={22} />
                ) : (
                  <RefreshCw size={22} />
                )}
              </button>
              <button
                className="header-icon"
                aria-label="Open settings"
                onClick={() => setScreen("settings")}
              >
                <Settings size={23} />
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main id="main">
        {demoMode ? (
          <div className="demo-banner">
            <span>Sample data</span>
            <button onClick={leaveDemo}>
              Use VTOP <ArrowRight size={14} />
            </button>
          </div>
        ) : null}
        {notice ? (
          <div className="notice" role="status">
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss notice"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
        {!ready ? (
          <div className="empty-inline">
            <LoaderCircle className="spinning" size={24} />
            Loading…
          </div>
        ) : profilePages.includes(screen) ? (
          <div className="profile-screen">
            <Sync
              online={online}
              settings={screen === "settings"}
              page={screen}
              onNavigate={setScreen}
              onSettings={() => setScreen("settings")}
              sessionToken={sessionToken}
              data={demoMode ? null : data}
              onData={receiveData}
              onSession={setSessionToken}
              onCalendar={receiveCalendar}
              onOverview={receiveOverview}
              onDemo={explore}
              onClear={forget}
            />
            {["profile", "courses", "exams", "widget-customization"].includes(screen) ? (
              <ProfileDetails
                data={data}
                page={screen}
                onNavigate={setScreen}
                timetableWidget={timetableWidget}
                onWidgetChange={handleWidgetChange}
              />
            ) : null}
            {screen === "simulator" ? (
              <Simulator
                key={`${demoMode}-${data?.semester?.id}`}
                data={data}
              />
            ) : null}
            {screen === "hostel-leave" ? (
              <HostelLeave
                data={data}
                token={sessionToken}
                online={online}
                demoMode={demoMode}
                onSession={setSessionToken}
                onLeave={receiveHostelLeave}
                onSync={() => setScreen("profile")}
              />
            ) : null}
            {screen === "settings" && installPrompt ? (
              <button
                className="button secondary full-width install-action"
                onClick={async () => {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                }}
              >
                <Download size={16} />
                Install app
              </button>
            ) : null}
            {screen === "settings" ? (
              <footer className="author-credit">by Kailash</footer>
            ) : null}
          </div>
        ) : screen === "calendar" ? (
          <Calendar
            calendar={data?.calendar}
            demoMode={demoMode}
            onSync={() => setScreen("profile")}
          />
        ) : !data ? (
          <div className="empty-workspace">
            <p>No synced data yet.</p>
            <button
              className="button primary"
              onClick={() => setScreen("profile")}
            >
              Connect VTOP <ArrowRight size={15} />
            </button>
            <button className="text-button" onClick={explore}>
              View demo
            </button>
          </div>
        ) : screen === "overview" ? (
          <Overview
            data={data}
            onNavigate={setScreen}
            onCalculate={openCalculator}
            timetableWidget={timetableWidget}
          />
        ) : screen === "attendance" ? (
          data.attendance.length ? (
            <CourseTable
              courses={data.attendance}
              target={75}
              onOpen={openCalculator}
            />
          ) : (
            <div className="empty-inline">No attendance published.</div>
          )
        ) : (
          <Marks data={data} newCourseKeys={marksHighlights} />
        )}
        {data &&
        screen !== "calendar" &&
        screen !== "profile" &&
        screen !== "settings" ? (
          <div className="semester-line">
            <span>{data.semester?.name || "Your semester"}</span>
            <span className="last-sync">
              {demoMode
                ? "Demo"
                : `Updated ${new Date(data.syncedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
            </span>
          </div>
        ) : null}
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={
              id === "marks" && !demoMode && data?.unreadMarks?.length
                ? "Marks, new marks available"
                : label
            }
            className={
              screen === id ||
              (profilePages.includes(screen) && id === "profile")
                ? "active"
                : ""
            }
            aria-current={screen === id ? "page" : undefined}
            onClick={() => setScreen(id)}
          >
            <span className="bottom-icon">
              <Icon size={25} strokeWidth={1.9} />
              {id === "marks" && !demoMode && data?.unreadMarks?.length ? (
                <span className="new-marks-dot" aria-hidden="true" />
              ) : null}
            </span>
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>
      {course ? (
        <Calculator
          course={course}
          target={75}
          onClose={() => setCourse(null)}
        />
      ) : null}
    </div>
  );
}
