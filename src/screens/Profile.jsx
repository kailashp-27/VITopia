import { groupCourses, groupExams } from "../profile-groups.js";
import {
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Home,
  Layout,
  MapPin,
  Mail,
  Moon,
  Palette,
  Phone,
  Sun,
  User,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { findFacultyCabin } from "../faculty-cabins.js";
import { readFacultyCabins, saveFacultyCabins } from "../db.js";
import { getExamCountdown } from "../exam-utils.js";
import { demo } from "../demo.js";
import { THEMES, applyTheme, getSavedThemeId } from "../theme.js";

function inferBranchFromReg(reg) {
  if (typeof reg !== "string" || !reg) return "";
  const match = reg.match(/\d{2}([A-Za-z]{2,5})\d+/);
  if (!match) return "";
  const code = match[1].toUpperCase();
  const branches = {
    BCE: "B.Tech Computer Science and Engineering",
    BCSE: "B.Tech Computer Science and Engineering",
    BAI: "B.Tech CSE (Artificial Intelligence & Machine Learning)",
    BDS: "B.Tech CSE (Data Science)",
    BCY: "B.Tech CSE (Cyber Security)",
    BIT: "B.Tech Information Technology",
    BEC: "B.Tech Electronics and Communication Engineering",
    BECE: "B.Tech Electronics and Communication Engineering",
    BEE: "B.Tech Electrical and Electronics Engineering",
    BEEE: "B.Tech Electrical and Electronics Engineering",
    BME: "B.Tech Mechanical Engineering",
    BMECH: "B.Tech Mechanical Engineering",
    BCI: "B.Tech Civil Engineering",
    BCIV: "B.Tech Civil Engineering",
    BCH: "B.Tech Chemical Engineering",
    MIS: "Integrated M.Tech Software Engineering",
    MDS: "Integrated M.Tech Data Science",
    MCA: "Master of Computer Applications",
    MBA: "Master of Business Administration",
    BBA: "Bachelor of Business Administration",
    LLB: "Bachelor of Laws (LL.B)",
    BDES: "Bachelor of Design",
    BARCH: "Bachelor of Architecture",
  };
  return branches[code] || `Branch (${code})`;
}

function inferYearFromReg(reg) {
  if (typeof reg !== "string" || !reg) return "";
  const match = reg.match(/^(\d{2})[A-Za-z]/);
  if (match) return `20${match[1]}`;
  return "";
}

function renderPreviewWidget(widgetType) {
  if (widgetType === "attendance") {
    return <span className="class-widget attendance-widget">85.0%</span>;
  }
  if (widgetType === "venue") {
    return (
      <span className="class-widget venue-widget">
        <MapPin size={11} />
        <span>AB1-313</span>
      </span>
    );
  }
  if (widgetType === "slot") {
    return <span className="class-widget slot-widget">A1</span>;
  }
  return null;
}

const WIDGET_OPTIONS = [
  {
    id: "attendance",
    label: "Course Attendance",
    description: "Current course attendance percentage",
    sample: <span className="class-widget attendance-widget">85.0%</span>,
  },
  {
    id: "venue",
    label: "Course Place (Venue)",
    description: "Classroom or lab location",
    sample: (
      <span className="class-widget venue-widget">
        <MapPin size={11} />
        <span>AB1-313</span>
      </span>
    ),
  },
  {
    id: "slot",
    label: "Course Slot",
    description: "Course timetable slot code",
    sample: <span className="class-widget slot-widget">A1</span>,
  },
  {
    id: "none",
    label: "None",
    description: "Hide the right-side widget column",
    sample: <span className="class-widget none-widget">—</span>,
  },
];

function ThemeGallery({ activeThemeId, onSelectTheme }) {
  const lightThemes = THEMES.filter((t) => t.group === "light");
  const darkThemes = THEMES.filter((t) => t.group === "dark");

  const renderCard = (t) => {
    const isSelected = activeThemeId === t.id;
    return (
      <button
        key={t.id}
        type="button"
        className={`theme-card ${isSelected ? "selected" : ""}`}
        style={{
          background: t.surface,
          color: t.text,
          borderColor: isSelected ? t.accent : t.line,
        }}
        onClick={() => onSelectTheme(t.id)}
      >
        <div className="theme-card-header">
          <span className="theme-card-name" style={{ color: t.text }}>
            {t.name}
          </span>
          {isSelected ? (
            <span
              className="theme-check-badge"
              style={{ background: t.accent }}
              aria-label="Selected theme"
            >
              <Check size={11} strokeWidth={3} />
            </span>
          ) : null}
        </div>

        {/* Mini UI Mockup */}
        <div
          className="theme-mockup"
          style={{
            background: t.bg,
            borderColor: t.line,
          }}
        >
          <div className="theme-mockup-bar">
            <span
              className="theme-mockup-dot"
              style={{ background: t.accent }}
            />
            <span
              className="theme-mockup-line"
              style={{ background: t.line }}
            />
          </div>
          <div className="theme-mockup-content">
            <div
              className="theme-mockup-box"
              style={{
                background: t.surfaceAlt,
                borderColor: t.line,
              }}
            />
            <div
              className="theme-mockup-box"
              style={{
                background: t.surfaceAlt,
                borderColor: t.line,
              }}
            />
          </div>
        </div>

        {/* Footer with preview dots and sun/moon */}
        <div className="theme-card-footer">
          <div className="theme-dots">
            {t.previewDots.map((dotColor, i) => (
              <span
                key={i}
                className="theme-dot"
                style={{ background: dotColor }}
              />
            ))}
          </div>
          <span className="theme-indicator" style={{ color: t.muted }}>
            {t.group === "light" ? <Sun size={12} /> : <Moon size={12} />}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="theme-gallery">
      <div className="theme-section-title">
        <Sun size={14} />
        <span>Light Themes</span>
      </div>
      <div className="theme-cards-grid">{lightThemes.map(renderCard)}</div>

      <div className="theme-section-title" style={{ marginTop: "16px" }}>
        <Moon size={14} />
        <span>Dark Themes</span>
      </div>
      <div className="theme-cards-grid">{darkThemes.map(renderCard)}</div>
    </div>
  );
}

export default function ProfileDetails({
  data,
  page,
  onNavigate,
  timetableWidget = "attendance",
  onWidgetChange,
  demoMode = false,
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [showCgpa, setShowCgpa] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState(getSavedThemeId());

  const handleThemeSelect = (themeId) => {
    setActiveThemeId(themeId);
    applyTheme(themeId);
  };
  const copyText = (text, key) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const profile =
    data?.overview?.profile || (demoMode ? demo.overview?.profile : null);
  const regNumber = profile?.registration || "";
  const studentName = profile?.name || (demoMode ? "Aditya Sharma" : "");
  const yearJoined =
    profile?.yearJoined ||
    inferYearFromReg(regNumber) ||
    (demoMode ? "2023" : "");
  const emailId =
    profile?.email || (demoMode ? "aditya.sharma2023@vitstudent.ac.in" : "");
  const dob = profile?.dob || (demoMode ? "14-Aug-2005" : "");
  const gender = profile?.gender || (demoMode ? "Male" : "");
  const branch =
    profile?.branch ||
    inferBranchFromReg(regNumber) ||
    (demoMode ? "B.Tech Computer Science and Engineering" : "");
  const campus =
    profile?.campus ||
    (regNumber || demoMode ? "Chennai Campus" : "");
  const cgpa =
    profile?.cgpa ||
    data?.overview?.cgpa ||
    data?.cgpa ||
    (demoMode ? "9.18" : "");
  const creditsCompleted =
    profile?.creditsEarned ||
    data?.overview?.creditsEarned ||
    (demoMode ? "89.0" : "");
  const proctor =
    profile?.proctor || (demoMode ? demo.overview?.profile?.proctor : null);
  const hasDetails = Boolean(studentName || regNumber || demoMode);

  const registered = data?.overview?.courses;
  const courses = registered?.length ? registered : data?.attendance || [];
  const courseGroups = groupCourses(courses);
  const totalCourses = courseGroups.length;
  const totalCredits = courses.reduce((sum, course) => {
    const cred =
      course.credits ??
      data?.overview?.courses?.find((c) => c.code === course.code)?.credits;
    return sum + (Number.isFinite(Number(cred)) ? Number(cred) : 0);
  }, 0);
  const exams = data?.overview?.exams;
  const [cabins, setCabins] = useState({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  useEffect(() => {
    let active = true;
    readFacultyCabins()
      .then((value) => {
        if (active && value) setCabins(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const facultyFor = (course) =>
    course.faculty ||
    data?.overview?.timetable?.classes?.find(
      (item) => item.code === course.code,
    )?.faculty ||
    "";
  async function lookupCabins() {
    if (lookupBusy) return;
    setLookupBusy(true);
    setLookupMessage("");
    try {
      const { default: directory } =
        await import("../data/faculty-cabins.json");
      const names = [...new Set(courses.map(facultyFor).filter(Boolean))];
      const results = Object.fromEntries(
        names.map((name) => [name, findFacultyCabin(name, directory)]),
      );
      const next = { ...cabins, ...results };
      setCabins(next);
      const found = Object.values(results).filter(Boolean).length;
      setLookupMessage(
        `${found} of ${names.length} faculty entries matched. Other cabins are not available.`,
      );
      try {
        await saveFacultyCabins(next);
      } catch {
        setLookupMessage(
          `${found} matched. Results could not be saved on this device.`,
        );
      }
    } catch {
      setLookupMessage("The directory could not be opened. Please try again.");
    } finally {
      setLookupBusy(false);
    }
  }
  return (
    <div className="profile-details">
      {page === "profile" ? (
        <nav className="profile-page-list" aria-label="Profile sections">
          <button onClick={() => onNavigate("proctor")}>
            Proctor information <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("courses")}>
            Course list <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("exams")}>
            Exam schedule <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("share-timetable")}>
            Friend’s timetable & QR sharing <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("simulator")}>
            Attendance Simulator <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("cgpa-calculator")}>
            CGPA Predictor & Targeter <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("hostel-leave")}>
            Hostel leave <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("settings")}>
            Settings <span aria-hidden="true">›</span>
          </button>
        </nav>
      ) : null}
      {page === "courses" ? (
        <>
          <section aria-label="Current semester courses">
            <div className="summary-grid overview-details course-stats">
              <section className="summary-card compact-summary overview-stat">
                <BookOpen size={20} />
                <h2>Total courses</h2>
                <strong className="metric-number">{totalCourses}</strong>
                <small>
                  {courses.length !== totalCourses
                    ? `${courses.length} class components`
                    : "Registered this semester"}
                </small>
              </section>
              <section className="summary-card compact-summary overview-stat">
                <GraduationCap size={20} />
                <h2>Total credits</h2>
                <strong className="metric-number">
                  {totalCredits || "—"}
                </strong>
                <small>This semester</small>
              </section>
            </div>
            <button
              type="button"
              className="button secondary full-width faculty-lookup"
              disabled={lookupBusy || !courses.length}
              onClick={lookupCabins}
            >
              {lookupBusy ? "Looking up cabins…" : "Look up faculty cabins"}
            </button>
            {lookupMessage ? (
              <p className="footnote" role="status">
                {lookupMessage}
              </p>
            ) : null}
            {courses.length ? (
              courseGroups.map((group) => (
                <article
                  className="profile-course grouped-course"
                  key={group.items.map((course) => course.code).join("-")}
                >
                  <h2>{group.title}</h2>
                  {group.items.map((course) => (
                    <div
                      className="course-component"
                      key={`${course.code}-${course.type}`}
                    >
                      <span>
                        {course.code} · {course.type || "Course"}
                      </span>
                      <span className="course-faculty">
                        Faculty:{" "}
                        {facultyFor(course) || "Not available — sync to fetch"}
                      </span>
                      <small>
                        Cabin:{" "}
                        {cabins[facultyFor(course)] ||
                          course.cabin ||
                          "Not available"}
                      </small>
                      <small>
                        {Number.isFinite(course.credits)
                          ? `${course.credits} credits`
                          : "Credits not available"}
                        {course.slot ? ` · ${course.slot}` : ""}
                      </small>
                    </div>
                  ))}
                </article>
              ))
            ) : (
              <p className="empty-inline">
                No courses synced for this semester.
              </p>
            )}
          </section>
        </>
      ) : null}
      {page === "exams" ? (
        <>
          <section aria-label="Semester exam schedule">
            {!exams?.available ? (
              <p className="empty-inline">
                Exam schedule not available. Sync to fetch it from VTOP.
              </p>
            ) : !exams.items.length ? (
              <p className="empty-inline">
                VTOP has not published exams for this semester.
              </p>
            ) : (
              groupExams(exams.items).map((group) => (
                <details
                  className="exam-group"
                  key={group.title}
                  aria-label={group.title}
                >
                  <summary>
                    <h2>{group.title}</h2>
                    <span>{group.items.length} exams</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div className="exam-list">
                    {group.items.map((exam, i) => {
                      const matches = courses.filter(
                        (c) =>
                          c.code === exam.code ||
                          (exam.slot &&
                            c.slot
                              ?.split("+")
                              .includes(exam.slot.split("+")[0])),
                      );
                      const title =
                        exam.title ||
                        (matches.length === 1 ? matches[0].title : "");
                      const countdown = getExamCountdown(exam.date, exam.time);
                      return (
                        <article
                          className={`exam-row ${countdown?.kind === "done" ? "exam-row-done" : ""}`}
                          key={`${exam.examType}-${exam.slot}-${exam.date}-${i}`}
                        >
                          <div className="exam-date">
                            <span>{exam.date || "Date pending"}</span>
                            <small>{exam.time || "Time pending"}</small>
                            {countdown ? (
                              <span className={`exam-countdown-pill ${countdown.kind}`}>
                                {countdown.label}
                              </span>
                            ) : null}
                          </div>
                          <div className="exam-info">
                            <h3>
                              {title ||
                                (exam.slot
                                  ? `Slot ${exam.slot}`
                                  : exam.code || "Examination")}
                            </h3>
                            <p className="exam-meta">
                              <span>
                                {[exam.venue, exam.location]
                                  .filter(Boolean)
                                  .join(" · ") || "Venue pending"}
                              </span>
                              {exam.seat ? <span>Seat {exam.seat}</span> : null}
                              {exam.slot ? <span>Slot {exam.slot}</span> : null}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              ))
            )}
          </section>
        </>
      ) : null}
      {page === "settings" ? (
        <section
          className="settings-preferences-section"
          aria-label="App preferences"
        >
          <h2 className="profile-section-title">Preferences</h2>
          <nav className="profile-page-list settings-page-list" aria-label="Preferences">
            <button
              type="button"
              onClick={() => onNavigate("widget-customization")}
            >
              Timetable widget <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("theme-customization")}
            >
              Appearance & Theme <span aria-hidden="true">›</span>
            </button>
          </nav>
        </section>
      ) : null}
      {page === "theme-customization" ? (
        <section
          className="theme-customization-screen"
          aria-label="Appearance & Theme"
        >
          <ThemeGallery
            activeThemeId={activeThemeId}
            onSelectTheme={handleThemeSelect}
          />
        </section>
      ) : null}
      {page === "widget-customization" ? (
        <section
          className="widget-customization-screen"
          aria-label="Widget customization"
        >
          <div className="widget-preview-card">
            <span className="widget-preview-title">Live Preview</span>
            <article className="daily-class preview-daily-class">
              <div className="class-time">
                <time>08:00</time>
                <small>08:50</small>
              </div>
              <div className="class-info">
                <h3>Software Engineering</h3>
              </div>
              <div className="class-right">
                {renderPreviewWidget(timetableWidget)}
              </div>
            </article>
          </div>
          <div
            className="widget-options-list"
            role="radiogroup"
            aria-label="Timetable right-side widget options"
          >
            {WIDGET_OPTIONS.map((opt) => {
              const selected = timetableWidget === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`widget-option-item ${
                    selected ? "selected" : ""
                  }`}
                  onClick={() => onWidgetChange && onWidgetChange(opt.id)}
                >
                  <div className="widget-option-radio">
                    <span className="radio-indicator" />
                  </div>
                  <div className="widget-option-details">
                    <strong>{opt.label}</strong>
                    <span>{opt.description}</span>
                  </div>
                  <div className="widget-option-badge">{opt.sample}</div>
                </button>
              );
            })}
          </div>
          <p className="footnote">
            The selected option appears in the right-side frame of each class in
            Today’s Timetable on the Home screen.
          </p>
        </section>
      ) : null}
      {page === "details" ? (
        <section className="student-details-screen" aria-label="Student details">
          {!hasDetails ? (
            <div className="empty-workspace">
              <p>Student details not synced yet.</p>
              <button
                type="button"
                className="button primary"
                onClick={() => onNavigate("profile")}
              >
                Go to sync
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="student-cgpa-banner"
                onClick={() => setShowCgpa((prev) => !prev)}
                aria-label={showCgpa ? "Hide CGPA" : "Show CGPA"}
                title="Click to view/hide CGPA"
              >
                <div className="cgpa-left">
                  <div className="cgpa-icon-wrapper" aria-hidden="true">
                    <Award size={22} />
                  </div>
                  <div>
                    <span className="cgpa-label">Current CGPA</span>
                    <span className="cgpa-sub">
                      Cumulative Grade Point Average
                      {creditsCompleted ? ` · ${creditsCompleted} credits completed` : ""}
                    </span>
                    <span className="cgpa-toggle-hint">
                      {showCgpa ? (
                        <>
                          <EyeOff size={11} aria-hidden="true" />
                          <span>Click to hide</span>
                        </>
                      ) : (
                        <>
                          <Eye size={11} aria-hidden="true" />
                          <span>Click to show CGPA</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="cgpa-value">
                  {showCgpa ? (
                    cgpa ? (
                      <strong>{cgpa}</strong>
                    ) : (
                      <span className="cgpa-placeholder" title="CGPA not published on VTOP yet">
                        —
                      </span>
                    )
                  ) : (
                    <span className="cgpa-masked" aria-label="Hidden CGPA">
                      ###
                    </span>
                  )}
                </div>
              </button>

              {proctor?.name ? (
                <button
                  type="button"
                  className="proctor-shortcut-card"
                  onClick={() => onNavigate("proctor")}
                  aria-label="View proctor information"
                >
                  <div className="proctor-shortcut-left">
                    <div className="proctor-shortcut-icon" aria-hidden="true">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <span className="proctor-shortcut-label">Faculty Proctor</span>
                      <strong className="proctor-shortcut-name">{proctor.name}</strong>
                      {proctor.cabin ? (
                        <span className="proctor-shortcut-cabin">{proctor.cabin}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="proctor-shortcut-arrow" aria-hidden="true">›</span>
                </button>
              ) : null}

              {/* Three small boxes: Student Name, Registration Number, Application Number */}
              <div className="student-trio-grid">
                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <User size={13} aria-hidden="true" />
                    <span>Student Name</span>
                  </div>
                  <strong>{studentName || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <Hash size={13} aria-hidden="true" />
                    <span>Register No.</span>
                  </div>
                  <strong>{regNumber || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <Hash size={13} aria-hidden="true" />
                    <span>Application No.</span>
                  </div>
                  <strong>{profile?.applicationNumber || "—"}</strong>
                </div>
              </div>

              {/* Two or three big boxes: VTOP Mail ID, Current Branch, School */}
              <div className="student-big-boxes">
                <div className="detail-big-card">
                  <div className="detail-item-header">
                    <Mail size={14} aria-hidden="true" />
                    <span>VTOP Mail ID</span>
                  </div>
                  <div className="detail-email-row">
                    <strong>{emailId || "—"}</strong>
                    {emailId ? (
                      <div className="detail-email-actions">
                        <button
                          type="button"
                          className="icon-text-btn"
                          title="Copy email"
                          aria-label="Copy email"
                          onClick={() => copyText(emailId, "student-email")}
                        >
                          {copiedKey === "student-email" ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedKey === "student-email" ? "Copied" : "Copy"}</span>
                        </button>
                        <a
                          href={`mailto:${emailId}`}
                          className="icon-text-btn"
                          title="Compose email"
                          aria-label="Compose email"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="detail-big-card">
                  <div className="detail-item-header">
                    <GraduationCap size={14} aria-hidden="true" />
                    <span>Current Branch</span>
                  </div>
                  <strong>{branch || "—"}</strong>
                </div>

                {profile?.school ? (
                  <div className="detail-big-card">
                    <div className="detail-item-header">
                      <Building2 size={14} aria-hidden="true" />
                      <span>School</span>
                    </div>
                    <strong>{profile.school}</strong>
                  </div>
                ) : null}
              </div>

              {/* Multiple small boxes: Year Joined, Campus, Credits Completed, Date of Birth, Gender, Blood Group, Personal Email */}
              <div className="student-small-grid">
                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <Calendar size={13} aria-hidden="true" />
                    <span>Year Joined</span>
                  </div>
                  <strong>{yearJoined || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <Building2 size={13} aria-hidden="true" />
                    <span>Campus</span>
                  </div>
                  <strong>{campus || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <GraduationCap size={13} aria-hidden="true" />
                    <span>Credits Completed</span>
                  </div>
                  <strong>{creditsCompleted || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <Calendar size={13} aria-hidden="true" />
                    <span>Date of Birth</span>
                  </div>
                  <strong>{dob || "—"}</strong>
                </div>

                <div className="detail-item-card">
                  <div className="detail-item-header">
                    <User size={13} aria-hidden="true" />
                    <span>Gender</span>
                  </div>
                  <strong>{gender || "—"}</strong>
                </div>

                {profile?.bloodGroup ? (
                  <div className="detail-item-card">
                    <div className="detail-item-header">
                      <Award size={13} aria-hidden="true" />
                      <span>Blood Group</span>
                    </div>
                    <strong>{profile.bloodGroup}</strong>
                  </div>
                ) : null}

                {profile?.personalEmail ? (
                  <div className="detail-item-card full-span">
                    <div className="detail-item-header">
                      <Mail size={13} aria-hidden="true" />
                      <span>Personal Email</span>
                    </div>
                    <div className="detail-email-row">
                      <strong>{profile.personalEmail}</strong>
                      <div className="detail-email-actions">
                        <button
                          type="button"
                          className="icon-text-btn"
                          title="Copy email"
                          aria-label="Copy email"
                          onClick={() => copyText(profile.personalEmail, "personal-email")}
                        >
                          {copiedKey === "personal-email" ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedKey === "personal-email" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {(!cgpa || !creditsCompleted) && !demoMode ? (
                <div style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
                  <button
                    type="button"
                    className="button secondary full-width"
                    onClick={() => onNavigate("profile")}
                  >
                    Sync now to fetch CGPA & academic details
                  </button>
                </div>
              ) : null}

              <p className="footnote student-details-footnote">
                Details imported from VTOP Student Profile.
              </p>
            </>
          )}
        </section>
      ) : null}
      {page === "proctor" ? (
        <section className="proctor-details-screen" aria-label="Proctor information">
          {!proctor?.name && !proctor?.email && !proctor?.id ? (
            <div className="empty-workspace">
              <p>Proctor information not synced yet.</p>
              <button
                type="button"
                className="button primary"
                onClick={() => onNavigate("profile")}
              >
                Back to profile
              </button>
            </div>
          ) : (
            <>
              <div className="proctor-hero-card">
                {proctor.photo ? (
                  <img
                    className="proctor-avatar-img"
                    src={proctor.photo}
                    alt={proctor.name || "Faculty Proctor"}
                  />
                ) : (
                  <div className="proctor-avatar-badge" aria-hidden="true">
                    <UserCheck size={32} />
                  </div>
                )}
                <div className="proctor-hero-info">
                  <h2>{proctor.name || "Faculty Proctor"}</h2>
                  {proctor.designation ? (
                    <p className="proctor-designation">{proctor.designation}</p>
                  ) : null}
                  <div className="proctor-hero-badges">
                    {proctor.id ? (
                      <span className="proctor-badge">ID: {proctor.id}</span>
                    ) : null}
                    {proctor.school ? (
                      <span className="proctor-badge secondary">{proctor.school}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="student-details-grid">
                {proctor.cabin ? (
                  <div className="detail-item-card full-span">
                    <div className="detail-item-header">
                      <MapPin size={14} aria-hidden="true" />
                      <span>Cabin Location</span>
                    </div>
                    <div className="detail-email-row">
                      <strong>{proctor.cabin}</strong>
                      <button
                        type="button"
                        className="icon-text-btn"
                        title="Copy cabin"
                        aria-label="Copy cabin"
                        onClick={() => copyText(proctor.cabin, "proctor-cabin")}
                      >
                        {copiedKey === "proctor-cabin" ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedKey === "proctor-cabin" ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {proctor.email ? (
                  <div className="detail-item-card full-span">
                    <div className="detail-item-header">
                      <Mail size={14} aria-hidden="true" />
                      <span>Email Address</span>
                    </div>
                    <div className="detail-email-row">
                      <strong>{proctor.email}</strong>
                      <div className="detail-email-actions">
                        <button
                          type="button"
                          className="icon-text-btn"
                          title="Copy email"
                          aria-label="Copy email"
                          onClick={() => copyText(proctor.email, "proctor-email")}
                        >
                          {copiedKey === "proctor-email" ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedKey === "proctor-email" ? "Copied" : "Copy"}</span>
                        </button>
                        <a
                          href={`mailto:${proctor.email}`}
                          className="icon-text-btn"
                          title="Compose email"
                          aria-label="Compose email"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {proctor.mobile ? (
                  <div className="detail-item-card full-span">
                    <div className="detail-item-header">
                      <Phone size={14} aria-hidden="true" />
                      <span>Mobile Number</span>
                    </div>
                    <div className="detail-email-row">
                      <strong>{proctor.mobile}</strong>
                      <div className="detail-email-actions">
                        <button
                          type="button"
                          className="icon-text-btn"
                          title="Copy mobile number"
                          aria-label="Copy mobile number"
                          onClick={() => copyText(proctor.mobile, "proctor-mobile")}
                        >
                          {copiedKey === "proctor-mobile" ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedKey === "proctor-mobile" ? "Copied" : "Copy"}</span>
                        </button>
                        <a
                          href={`tel:${proctor.mobile}`}
                          className="icon-text-btn"
                          title="Call proctor"
                          aria-label="Call proctor"
                        >
                          <Phone size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {proctor.department ? (
                  <div className="detail-item-card full-span">
                    <div className="detail-item-header">
                      <Briefcase size={14} aria-hidden="true" />
                      <span>Department</span>
                    </div>
                    <strong>{proctor.department}</strong>
                  </div>
                ) : null}

                {proctor.school ? (
                  <div className="detail-item-card">
                    <div className="detail-item-header">
                      <Building2 size={14} aria-hidden="true" />
                      <span>School / Centre</span>
                    </div>
                    <strong>{proctor.school}</strong>
                  </div>
                ) : null}

                {proctor.id ? (
                  <div className="detail-item-card">
                    <div className="detail-item-header">
                      <Hash size={14} aria-hidden="true" />
                      <span>Employee ID</span>
                    </div>
                    <strong>{proctor.id}</strong>
                  </div>
                ) : null}

                {proctor.intercom ? (
                  <div className="detail-item-card">
                    <div className="detail-item-header">
                      <Phone size={14} aria-hidden="true" />
                      <span>Intercom</span>
                    </div>
                    <strong>{proctor.intercom}</strong>
                  </div>
                ) : null}
              </div>

              <p className="footnote student-details-footnote">
                Proctor details fetched directly from VTOP Student Profile.
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
