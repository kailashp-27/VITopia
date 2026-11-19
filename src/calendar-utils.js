export const CALENDAR_CATEGORIES = [
  { id: "general", label: "General" },
  { id: "general-flexible", label: "General Flexible" },
  { id: "fresher", label: "Fresher" },
];

export const DEFAULT_CALENDAR_CATEGORY = "general";
const CALENDAR_CATEGORY_KEY = "vtopia_calendar_category";

export function isValidCalendarCategory(value) {
  return CALENDAR_CATEGORIES.some((c) => c.id === value);
}

export function getSavedCalendarCategory() {
  try {
    const saved = localStorage.getItem(CALENDAR_CATEGORY_KEY);
    return isValidCalendarCategory(saved) ? saved : DEFAULT_CALENDAR_CATEGORY;
  } catch {
    return DEFAULT_CALENDAR_CATEGORY;
  }
}

export function saveCalendarCategory(category) {
  const next = isValidCalendarCategory(category)
    ? category
    : DEFAULT_CALENDAR_CATEGORY;
  try {
    localStorage.setItem(CALENDAR_CATEGORY_KEY, next);
  } catch {}
  return next;
}

export function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function extractDayOrder(text) {
  if (!text) return null;
  const match =
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:Day\s+)?Order/i.exec(
      String(text),
    );
  if (!match) return null;
  return match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
}

const HOLIDAY_RE =
  /\bholidays?\b|\bvacation\b|\b(?:non|no)[ -]?instructional\b|\bno classes\b/i;
const WORKING_RE = /\binstructional(?:\s+day)?\b|\bworking(?:\s+day|\s+saturday)?\b/i;

export function classifyCalendarSegment(segment) {
  const text = String(segment || "").trim();
  if (!text) return [];
  const categories = [];
  if (/\b(?:general\s+)?flexi(?:ble)?\b|\bgfl\b/i.test(text)) {
    categories.push("general-flexible");
  }
  if (/\bfreshers?\b|\bfreshm[ae]n\b|\b(?:1st|first)\s+year\b/i.test(text)) {
    categories.push("fresher");
  }
  if (/\blaw\b|\bvit\s*school\s*of\s*law\b|\bvitsol\b/i.test(text)) {
    categories.push("law");
  }
  // Remove subgroup phrases before testing standalone "general"
  const withoutSubgroups = text
    .replace(/\bgeneral\s+flexi(?:ble)?\b/gi, " ")
    .replace(
      /\bgeneral\s*(?:\(\s*(?:freshers?|law)[^)]*\)|[-–—:]?\s*(?:freshers?|law)(?:\s+students?)?\b)/gi,
      " ",
    );
  if (/\bgeneral\b/i.test(withoutSubgroups)) {
    categories.push("general");
  }
  return categories;
}

export function stripCategoryPrefix(segment) {
  let cleaned = String(segment || "").trim();
  const token =
    "(?:general\\s+flexi(?:ble)?|general\\s*(?:\\(\\s*(?:freshers?|law)[^)]*\\)|(?:freshers?|law)(?:\\s+students?)?)|(?:freshers?|freshm[ae]n|(?:1st|first)\\s+year|law)(?:\\s+students?)?|general)";
  const leadingRe = new RegExp(
    `^(?:only\\s+)?(?:for\\s+)?${token}(?:\\s*(?:,|&|and)\\s*${token})*\\s*(?:[-–—:]|\\bfor\\b)?\\s*`,
    "i",
  );
  const trailingRe = new RegExp(
    `\\s*[-–—:]?\\s*(?:only\\s+)?for\\s+${token}\\s*$`,
    "i",
  );
  cleaned = cleaned
    .replace(leadingRe, "")
    .replace(trailingRe, "")
    .replace(/^\(|\)$/g, "")
    .trim();
  return cleaned;
}

export function academicDayStatus(day) {
  if (!day) return "unknown";
  // Explicit closures override a generic instructional flag, including in
  // snapshots saved before the parser learned to resolve conflicting labels.
  if (HOLIDAY_RE.test(day.label || "")) return "holiday";
  return day.instructional === true
    ? "working"
    : day.instructional === false
      ? "holiday"
      : "unknown";
}

export function resolveDayForCategory(
  day,
  category = DEFAULT_CALENDAR_CATEGORY,
) {
  if (!day) return null;
  const activeCategory = isValidCalendarCategory(category)
    ? category
    : DEFAULT_CALENDAR_CATEGORY;

  if (day.byCategory?.[activeCategory]) {
    const specific = day.byCategory[activeCategory];
    const status = academicDayStatus(specific);
    const instructional = status === "unknown" ? null : status === "working";
    return {
      ...day,
      ...specific,
      instructional,
      status,
      dayOrder:
        status === "working"
          ? specific.dayOrder || extractDayOrder(specific.label)
          : null,
      conflict: false,
    };
  }

  const rawLabel = String(day.label || "").trim();
  const segments = rawLabel
    ? rawLabel
        .split(/\s*\/\s*|\s*;\s*|\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const classified = segments.map((text) => ({
    text,
    categories: classifyCalendarSegment(text),
  }));
  const hasCategoryAnnotations = classified.some(
    (entry) => entry.categories.length > 0,
  );

  if (!hasCategoryAnnotations) {
    const status = academicDayStatus(day);
    return {
      ...day,
      status,
      dayOrder:
        status === "working"
          ? day.dayOrder || extractDayOrder(rawLabel)
          : null,
    };
  }

  const matched = classified.filter((entry) =>
    entry.categories.includes(activeCategory),
  );
  const universal = classified.filter((entry) => entry.categories.length === 0);
  const universalText = universal.map((entry) => entry.text).join(" / ");

  if (matched.length > 0) {
    const matchedRaw = matched.map((entry) => entry.text).join(" / ");
    const cleanedParts = [
      ...matched.map((entry) => stripCategoryPrefix(entry.text)),
      ...universal
        .map((entry) => entry.text)
        .filter((t) => !HOLIDAY_RE.test(t) || HOLIDAY_RE.test(matchedRaw)),
    ].filter(Boolean);
    const label = [...new Set(cleanedParts)].join(" / ");
    const order =
      extractDayOrder(matchedRaw) || extractDayOrder(universalText) || null;

    let status;
    if (HOLIDAY_RE.test(matchedRaw)) {
      status = "holiday";
    } else if (order || WORKING_RE.test(matchedRaw)) {
      status = "working";
    } else if (day.instructional === true) {
      status = "working";
    } else if (day.instructional === false) {
      status = "holiday";
    } else {
      status = "unknown";
    }

    const instructional = status === "unknown" ? null : status === "working";
    return {
      ...day,
      instructional,
      status,
      label,
      dayOrder: status === "working" ? order : null,
      conflict: false,
    };
  }

  // Only OTHER categories were mentioned on this date.
  const otherText = classified
    .filter((entry) => entry.categories.length > 0)
    .map((entry) => entry.text)
    .join(" / ");
  const utcDay = day.date
    ? new Date(`${day.date}T12:00:00Z`).getUTCDay()
    : null;
  const isWeekend = utcDay === 6 || utcDay === 0;
  const otherIsWorking =
    Boolean(extractDayOrder(otherText)) || WORKING_RE.test(otherText);
  const otherIsHoliday = HOLIDAY_RE.test(otherText);

  if (isWeekend || (otherIsWorking && !otherIsHoliday)) {
    return {
      ...day,
      instructional: false,
      status: "holiday",
      dayOrder: null,
      label: universalText && HOLIDAY_RE.test(universalText) ? universalText : "",
      conflict: false,
    };
  }

  // Regular weekday where only another category had a holiday -> stays working for this category
  const status =
    universalText && HOLIDAY_RE.test(universalText)
      ? "holiday"
      : day.instructional === false && !otherIsHoliday
        ? "holiday"
        : "working";
  const instructional = status === "working";
  return {
    ...day,
    instructional,
    status,
    label: universalText,
    dayOrder: instructional ? extractDayOrder(universalText) : null,
    conflict: false,
  };
}

export function filterCalendarForCategory(
  calendar,
  category = DEFAULT_CALENDAR_CATEGORY,
) {
  if (!calendar) return calendar;
  const activeCategory = isValidCalendarCategory(category)
    ? category
    : DEFAULT_CALENDAR_CATEGORY;
  return {
    ...calendar,
    category: activeCategory,
    days: (calendar.days || []).map((day) =>
      resolveDayForCategory(day, activeCategory),
    ),
  };
}

export function workingSaturdaysForMonth(
  calendar,
  month,
  category = DEFAULT_CALENDAR_CATEGORY,
) {
  if (!calendar?.days?.length || !month) return [];
  const filtered = filterCalendarForCategory(calendar, category);
  return filtered.days.filter((day) => {
    if (!day.date?.startsWith(`${month}-`)) return false;
    const utcDay = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    return utcDay === 6 && day.status === "working";
  });
}

export function reminderCountdown(date, today = todayISO()) {
  const days = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86400000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${Math.abs(days)} days ago`;
}

export function monthGrid(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [
    ...Array(leading).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
}

export function moveMonth(month, delta) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    year: "numeric",
  });
}
