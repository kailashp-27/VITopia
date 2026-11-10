import { academicDayStatus } from "./calendar-utils.js";
import { formatExamType } from "./exam-utils.js";
import { THEMES, getSavedThemeId } from "./theme.js";

function resolveTheme(themeId) {
  const activeId = themeId || getSavedThemeId();
  const theme =
    THEMES.find((t) => t.id === activeId) ||
    THEMES.find((t) => t.id === "amoled-black") ||
    THEMES[0];
  const isLight = theme.group === "light";
  return {
    id: theme.id,
    bg: theme.bg,
    surface: theme.surface,
    surfaceAlt: theme.surfaceAlt,
    line: theme.line,
    text: theme.text,
    muted: theme.muted,
    accent: theme.accent,
    onAccent: theme.onAccent || "#ffffff",
    amber: theme.amber,
    isLight,
    statusDanger: isLight ? "#dc2626" : "#f87171",
    statusGood: isLight ? "#15803d" : "#4ade80",
  };
}

export function buildWidgetSnapshot({ data, demoMode = false, themeId } = {}) {
  const theme = resolveTheme(themeId);

  if (!data || demoMode) {
    return {
      version: 1,
      hasData: false,
      updatedAt: Date.now(),
      theme,
      timetableAvailable: false,
      classes: [],
      calendarDays: [],
      examsAvailable: false,
      exams: [],
    };
  }

  const attendanceMap = new Map(
    (data.attendance || []).map((course) => [course.code, course]),
  );
  const courseList = data.overview?.courses || data.attendance || [];

  const timetable = data.overview?.timetable;
  const timetableAvailable = Boolean(timetable?.available);
  const classes = timetableAvailable
    ? [...(timetable.classes || [])]
        .sort(
          (a, b) =>
            (a.day || "").localeCompare(b.day || "") ||
            (a.start || "").localeCompare(b.start || ""),
        )
        .map((item) => {
          const att = attendanceMap.get(item.code);
          let attendancePct = null;
          let attendanceWarning = false;
          if (att && att.total > 0) {
            const pct = (att.attended / att.total) * 100;
            attendancePct = pct.toFixed(1);
            attendanceWarning = pct < 75;
          } else if (att && Number.isFinite(Number(att.percent))) {
            const pct = Number(att.percent);
            attendancePct = pct.toFixed(1);
            attendanceWarning = pct < 75;
          }
          return {
            day: item.day || "",
            start: item.start || "",
            end: item.end || "",
            code: item.code || "",
            title: att?.title || item.title || item.code || "",
            slot: item.slot || "",
            venue: item.venue || "Room not listed",
            type: item.type || "",
            attendancePct,
            attendanceWarning,
          };
        })
    : [];

  const calendarDays = Array.isArray(data.calendar?.days)
    ? data.calendar.days
        .filter((d) => d && d.date)
        .map((d) => ({
          date: d.date,
          status: academicDayStatus(d),
          dayOrder: d.dayOrder ? String(d.dayOrder).slice(0, 3).toUpperCase() : "",
          label: d.label || "",
        }))
    : [];

  const examsObj = data.overview?.exams;
  const examsAvailable = Boolean(examsObj?.available);
  const exams = examsAvailable
    ? (examsObj.items || []).map((exam) => {
        const matches = courseList.filter(
          (c) =>
            c.code === exam.code ||
            (exam.slot &&
              c.slot?.split("+").includes(exam.slot.split("+")[0])),
        );
        const title =
          exam.title ||
          (matches.length === 1 ? matches[0].title : "") ||
          exam.code ||
          "Examination";
        const venue =
          [exam.venue, exam.location].filter(Boolean).join(" - ") ||
          exam.venue ||
          "Venue pending";
        return {
          code: exam.code || "",
          title,
          examType: formatExamType(exam.examType || "Exam"),
          date: exam.date || "",
          time: exam.time || "",
          venue,
          seat: exam.seat ? `Seat ${exam.seat}` : "",
          slot: exam.slot ? `Slot ${exam.slot}` : "",
        };
      })
    : [];

  return {
    version: 1,
    hasData: true,
    updatedAt: Date.now(),
    syncedAt: data.syncedAt || null,
    theme,
    timetableAvailable,
    classes,
    calendarDays,
    examsAvailable,
    exams,
  };
}
