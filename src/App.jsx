import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Download,
  Home,
  LayoutGrid,
  LoaderCircle,
  RefreshCw,
  Settings,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import Sync from "./screens/Sync.jsx";
import Overview from "./screens/Overview.jsx";
import Login from "./screens/Login.jsx";
import { Calculator, CourseTable, Marks } from "./components/Academic.jsx";
import { clearLogin, readLogin } from "./credentials.js";
import { clearEvents } from "./events.js";
import { clearCache, readCache, saveCache } from "./db.js";
import { fetchCalendar } from "./api-client.js";
import { demo } from "./demo.js";
import { unreadMarksCourses } from "./marks-updates.js";
import {
  initNativeBridge,
  isCapacitorNative,
  pinNativeWidget,
  pushWidgetSnapshot,
} from "./native-bridge.js";
import {
  closeTopBackOverlay,
  popOrFallbackBackScreen,
  pushHistoryScreen,
} from "./back-navigation.js";

const ProfileDetails = lazy(() => import("./screens/Profile.jsx"));
const Calendar = lazy(() => import("./screens/Calendar.jsx"));
const Simulator = lazy(() => import("./screens/Simulator.jsx"));
const HostelLeave = lazy(() => import("./screens/HostelLeave.jsx"));
const CgpaCalculator = lazy(() => import("./screens/CgpaCalculator.jsx"));
const ShareTimetable = lazy(() => import("./screens/ShareTimetable.jsx"));
const QuickSyncModal = lazy(() => import("./components/QuickSyncModal.jsx"));
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
  const navRef = useRef({ screen: "overview", stack: [] });
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
  const [installDismissed, setInstallDismissed] = useState(false);
  const [authHold, setAuthHold] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [quickSyncOpen, setQuickSyncOpen] = useState(false);
  const [quickSyncBusy, setQuickSyncBusy] = useState(false);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [widgetStatus, setWidgetStatus] = useState("");
  const calendarAbort = useRef(null);
  const demoModeRef = useRef(false);
  demoModeRef.current = demoMode;
  const online = useOnline();
  const isNativeApp = isCapacitorNative();
  const isStandalone =
    isNativeApp ||
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator?.standalone === true));
  const isIosInstallable =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !isStandalone;
  const showLoginGate = ready && !demoMode && (!data || authHold);
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
    "cgpa-calculator",
    "share-timetable",
    "hostel-leave",
    "widget-customization",
    "theme-customization",
    "details",
    "proctor",
  ];
  const readyRef = useRef(false);
  readyRef.current = ready;
  const showLoginGateRef = useRef(false);
  showLoginGateRef.current = showLoginGate;

  function selectTopTab(tabId) {
    navRef.current = { screen: tabId, stack: [] };
    setScreen(tabId);
  }

  function resetNavigation(nextScreen = "overview") {
    navRef.current = { screen: nextScreen, stack: [] };
    setScreen(nextScreen);
  }

  function navigateTo(nextScreen) {
    const { screen: current, stack } = navRef.current;
    if (!nextScreen || nextScreen === current) return;
    if (nextScreen === "profile" && profilePages.includes(current)) {
      const profileIdx = stack.lastIndexOf("profile");
      const nextStack = profileIdx >= 0 ? stack.slice(0, profileIdx) : [];
      navRef.current = { screen: "profile", stack: nextStack };
      setScreen("profile");
      return;
    }
    const nextStack = pushHistoryScreen(current, nextScreen, stack);
    navRef.current = { screen: nextScreen, stack: nextStack };
    setScreen(nextScreen);
  }

  function navigateBack() {
    const { screen: current, stack } = navRef.current;
    const { handled, nextScreen, nextStack } = popOrFallbackBackScreen(
      current,
      stack,
    );
    if (!handled) return false;
    navRef.current = { screen: nextScreen, stack: nextStack };
    setScreen(nextScreen);
    return true;
  }

  useEffect(() => {
    window.__vtopiaHandleBack = () => {
      if (!readyRef.current || showLoginGateRef.current) {
        return false;
      }
      if (closeTopBackOverlay()) {
        return true;
      }
      return navigateBack();
    };
    return () => {
      delete window.__vtopiaHandleBack;
    };
  }, []);
  const currentPage =
    {
      settings: { title: "Settings" },
      courses: { title: "Course list" },
      exams: { title: "Exam schedule" },
      simulator: { title: "Attendance Simulator" },
      "cgpa-calculator": { title: "CGPA Predictor & Targeter" },
      "share-timetable": { title: "Friend’s Timetable" },
      "hostel-leave": { title: "Hostel leave" },
      "widget-customization": { title: "Timetable widget" },
      "theme-customization": { title: "Appearance & Theme" },
      details: { title: "Student details" },
      proctor: { title: "Proctor information" },
    }[screen] || NAV.find((page) => page.id === screen);
  useEffect(() => {
    document.title = showLoginGate
      ? "Sign in · Vtopia"
      : `${currentPage.title} · Vtopia`;
  }, [currentPage.title, showLoginGate]);
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
    if (
      !import.meta.env.PROD ||
      isNativeApp ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() =>
        setNotice("Offline installation is unavailable in this browser."),
      );
  }, [isNativeApp]);
  useEffect(() => {
    if (!isNativeApp) return undefined;
    return initNativeBridge({
      onNavigate: (target) => {
        if (target === "overview" || target === "exams") {
          setPendingTarget(target);
        }
      },
      onThemeChange: (theme) => {
        void pushWidgetSnapshot(
          dataRef.current,
          demoModeRef.current,
          theme?.id,
        );
      },
    });
  }, [isNativeApp]);
  useEffect(() => {
    if (!pendingTarget || !ready || showLoginGate) return;
    if (pendingTarget === "exams") {
      navRef.current = { screen: "exams", stack: ["overview"] };
      setScreen("exams");
    } else {
      resetNavigation(pendingTarget);
    }
    setPendingTarget(null);
  }, [pendingTarget, ready, showLoginGate]);
  useEffect(() => {
    if (!ready || !isNativeApp) return;
    void pushWidgetSnapshot(data, demoMode);
  }, [ready, isNativeApp, data, demoMode]);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const installedHandler = () => {
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);
  async function handleInstallApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }
  async function handlePinWidget(kind) {
    setWidgetStatus("");
    try {
      const result = await pinNativeWidget(kind);
      if (result?.requested) {
        setWidgetStatus("Confirm adding the 2×2 widget on your home screen.");
      } else {
        setWidgetStatus(
          "Launcher auto-pinning unavailable. Long-press your home screen → Widgets → Vtopia.",
        );
      }
    } catch {
      setWidgetStatus(
        "Long-press your home screen → Widgets → Vtopia to add this widget.",
      );
    }
  }
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
    setAuthHold(false);
    setData(demo);
    setDemoMode(true);
    resetNavigation("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function leaveDemo() {
    setDemoMode(false);
    setData(dataRef.current);
    resetNavigation("overview");
  }
  async function forget() {
    try {
      await Promise.all([clearCache(), clearLogin(), clearEvents()]);
      dataRef.current = null;
      setAuthHold(false);
      setData(null);
      setDemoMode(false);
      setSessionToken(null);
      resetNavigation("overview");
      setNotice("Device data cleared.");
    } catch {
      setNotice("Could not clear all device data.");
    }
  }
  async function refresh() {
    if (screen === "calendar") {
      void refreshCalendar();
      return;
    }
    if (!online) {
      setNotice("Connect to the internet to sync.");
      return;
    }
    if (demoMode) {
      navigateTo("profile");
      return;
    }
    try {
      const savedLogin = sessionToken ? null : await readLogin().catch(() => null);
      if (sessionToken || savedLogin) {
        setNotice("");
        setQuickSyncOpen(true);
        return;
      }
    } catch {}
    navigateTo("profile");
  }
  if (!ready) {
    return (
      <div className="app-shell compact-app boot-shell">
        <div className="boot-loading" role="status">
          <LoaderCircle className="spinning" size={26} />
          <span>Loading Vtopia…</span>
        </div>
      </div>
    );
  }

  if (showLoginGate) {
    return (
      <div className="app-shell compact-app">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Login
          online={online}
          notice={notice}
          onDismissNotice={() => setNotice("")}
          onData={receiveData}
          onSession={setSessionToken}
          onCalendar={receiveCalendar}
          onOverview={receiveOverview}
          onStart={() => setAuthHold(true)}
          onFinish={(ok) => {
            setAuthHold(false);
            if (ok || dataRef.current) resetNavigation("overview");
          }}
          onDemo={explore}
          installPrompt={installPrompt}
          onInstallApp={handleInstallApp}
          isStandalone={isStandalone}
          isIosInstallable={isIosInstallable}
        />
      </div>
    );
  }

  return (
    <div className="app-shell compact-app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {screen !== "share-timetable" ? (
        <header className="app-header">
          <div className="page-title">
            {[
              "settings",
              "courses",
              "exams",
              "simulator",
              "cgpa-calculator",
              "hostel-leave",
              "widget-customization",
              "theme-customization",
              "details",
              "proctor",
            ].includes(screen) ? (
              <button
                type="button"
                className="header-icon"
                aria-label="Back"
                onClick={() => navigateBack()}
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
                      : "Quick sync account"
                  }
                  onClick={refresh}
                  disabled={calendarBusy || quickSyncBusy}
                >
                  {calendarBusy || quickSyncBusy ? (
                    <LoaderCircle className="spinning" size={22} />
                  ) : (
                    <RefreshCw size={22} />
                  )}
                </button>
                <button
                  className="header-icon"
                  aria-label="Open settings"
                  onClick={() => navigateTo("settings")}
                >
                  <Settings size={23} />
                </button>
              </>
            ) : null}
          </div>
        </header>
      ) : null}
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
            {screen !== "share-timetable" ? (
              <Sync
                online={online}
                settings={screen === "settings"}
                page={screen}
                onNavigate={navigateTo}
                onSettings={() => navigateTo("settings")}
                sessionToken={sessionToken}
                data={demoMode ? null : data}
                demoMode={demoMode}
                onData={receiveData}
                onSession={setSessionToken}
                onCalendar={receiveCalendar}
                onOverview={receiveOverview}
                onDemo={explore}
                onClear={forget}
              />
            ) : null}
            {["profile", "courses", "exams", "widget-customization", "theme-customization", "details", "proctor", "settings"].includes(screen) ? (
              <Suspense
                fallback={
                  <div className="empty-inline">
                    <LoaderCircle className="spinning" size={22} />
                    Loading…
                  </div>
                }
              >
                <ProfileDetails
                  data={data}
                  page={screen}
                  onNavigate={navigateTo}
                  timetableWidget={timetableWidget}
                  onWidgetChange={handleWidgetChange}
                  demoMode={demoMode}
                />
              </Suspense>
            ) : null}
            {screen === "simulator" ? (
              <Suspense
                fallback={
                  <div className="empty-inline">
                    <LoaderCircle className="spinning" size={22} />
                    Loading…
                  </div>
                }
              >
                <Simulator
                  key={`${demoMode}-${data?.semester?.id}`}
                  data={data}
                />
              </Suspense>
            ) : null}
            {screen === "cgpa-calculator" ? (
              <Suspense
                fallback={
                  <div className="empty-inline">
                    <LoaderCircle className="spinning" size={22} />
                    Loading…
                  </div>
                }
              >
                <CgpaCalculator
                  key={`${demoMode}-${data?.semester?.id}-${data?.overview?.profile?.registration || ""}`}
                  data={data}
                  demoMode={demoMode}
                  onNavigate={navigateTo}
                />
              </Suspense>
            ) : null}
            {screen === "share-timetable" ? (
              <Suspense
                fallback={
                  <div className="empty-inline">
                    <LoaderCircle className="spinning" size={22} />
                    Loading…
                  </div>
                }
              >
                <ShareTimetable
                  data={data}
                  demoMode={demoMode}
                  onNavigate={navigateTo}
                  onBack={navigateBack}
                />
              </Suspense>
            ) : null}
            {screen === "hostel-leave" ? (
              <Suspense
                fallback={
                  <div className="empty-inline">
                    <LoaderCircle className="spinning" size={22} />
                    Loading…
                  </div>
                }
              >
                <HostelLeave
                  data={data}
                  token={sessionToken}
                  online={online}
                  demoMode={demoMode}
                  onSession={setSessionToken}
                  onLeave={receiveHostelLeave}
                  onSync={() => navigateTo("profile")}
                />
              </Suspense>
            ) : null}
            {screen === "settings" && isNativeApp ? (
              <section
                className="settings-widgets-section"
                aria-label="Home screen widgets"
              >
                <h2 className="profile-section-title">Home screen widgets</h2>
                <div className="profile-page-list settings-page-list">
                  <button
                    type="button"
                    onClick={() => handlePinWidget("class")}
                  >
                    <span className="settings-widget-btn-label">
                      <LayoutGrid size={16} />
                      Current / Next Class (2×2)
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinWidget("exam")}
                  >
                    <span className="settings-widget-btn-label">
                      <LayoutGrid size={16} />
                      Next Exam Schedule (2×2)
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
                <p className="footnote settings-widget-note" role="status">
                  {widgetStatus ||
                    "Tap above or long-press your phone home screen → Widgets → Vtopia."}
                </p>
              </section>
            ) : null}
            {screen === "settings" && installPrompt && !isNativeApp ? (
              <button
                className="button secondary full-width install-action"
                onClick={handleInstallApp}
              >
                <Download size={16} />
                Install app
              </button>
            ) : null}
            {screen === "settings" ? (
              <footer className="author-credit">
                <a
                  href="https://github.com/kailashp-27"
                  target="_blank"
                  rel="noreferrer"
                  className="author-badge"
                  title="View Kailash's GitHub profile"
                >
                  <span>Developed by Kailash</span>
                  <svg
                    className="github-icon"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
              </footer>
            ) : null}
          </div>
        ) : screen === "calendar" ? (
          <Suspense
            fallback={
              <div className="empty-inline">
                <LoaderCircle className="spinning" size={22} />
                Loading…
              </div>
            }
          >
            <Calendar
              calendar={data?.calendar}
              demoMode={demoMode}
              onSync={() => navigateTo("profile")}
            />
          </Suspense>
        ) : !data ? (
          <div className="empty-workspace">
            <p>No synced data yet.</p>
            <button
              className="button primary"
              onClick={() => navigateTo("profile")}
            >
              Connect VTOP <ArrowRight size={15} />
            </button>
            <button className="text-button" onClick={explore}>
              View demo
            </button>
          </div>
        ) : screen === "overview" ? (
          <>
            {!isStandalone && !installDismissed && installPrompt ? (
              <div className="home-install-banner" role="region" aria-label="Install Vtopia app">
                <div className="home-install-copy">
                  <Download size={16} />
                  <span>
                    <strong>Install Vtopia</strong> for app icon & offline launch
                  </span>
                </div>
                <div className="home-install-actions">
                  <button
                    type="button"
                    className="home-install-cta"
                    onClick={handleInstallApp}
                  >
                    Install
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Dismiss install prompt"
                    onClick={() => setInstallDismissed(true)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : null}
            <Overview
              data={data}
              onNavigate={navigateTo}
              onCalculate={openCalculator}
              timetableWidget={timetableWidget}
            />
          </>
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
            onClick={() => selectTopTab(id)}
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
      {quickSyncOpen ? (
        <Suspense fallback={null}>
          <QuickSyncModal
            online={online}
            data={demoMode ? null : data}
            sessionToken={sessionToken}
            onData={receiveData}
            onSession={setSessionToken}
            onCalendar={receiveCalendar}
            onOverview={receiveOverview}
            onOpenSettings={() => navigateTo("settings")}
            onBusyChange={setQuickSyncBusy}
            onClose={() => {
              setQuickSyncOpen(false);
              setQuickSyncBusy(false);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
