export function parseExamDate(dateStr, timeStr) {
  if (!dateStr || typeof dateStr !== "string" || /pending/i.test(dateStr))
    return null;
  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const parts = dateStr.trim().split(/[- /.]/);
  let year, month, day;
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      year = Number(parts[0]);
      month = isNaN(parts[1])
        ? months[parts[1].toLowerCase().slice(0, 3)]
        : Number(parts[1]) - 1;
      day = Number(parts[2]);
    } else {
      day = Number(parts[0]);
      month = isNaN(parts[1])
        ? months[parts[1].toLowerCase().slice(0, 3)]
        : Number(parts[1]) - 1;
      year = Number(parts[2]);
    }
  }
  if (!year || month === undefined || !day || isNaN(year) || isNaN(day)) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  let hour = 9;
  let minute = 0;
  if (timeStr && typeof timeStr === "string") {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hour = Number(match[1]);
      minute = Number(match[2]);
      if (/pm/i.test(timeStr) && hour < 12) hour += 12;
      if (/am/i.test(timeStr) && hour === 12) hour = 0;
    }
  }
  return new Date(year, month, day, hour, minute);
}

export function formatExamType(rawType = "Exam") {
  const cleaned = String(rawType || "Exam").trim();
  const cat = cleaned.match(
    /(?:\bCAT|Continuous Assessment Test)\s*[-–:]?\s*(III|II|IV|I|[1-4])\b/i,
  );
  const number =
    cat && ({ I: 1, II: 2, III: 3, IV: 4 }[cat[1].toUpperCase()] || cat[1]);
  if (cat) return `CAT ${number}`;
  if (/\bFAT\b|Final Assessment Test|Term End Exam/i.test(cleaned))
    return "FAT";
  return cleaned;
}

export function getExamCountdown(dateStr, timeStr, now = new Date()) {
  const parsed = parseExamDate(dateStr, timeStr);
  if (!parsed) return null;
  const targetMidnight = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  ).getTime();
  const nowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diffDays = Math.round(
    (targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return { label: "Today", kind: "soon", diffDays, parsed };
  if (diffDays === 1)
    return { label: "Tomorrow", kind: "soon", diffDays, parsed };
  if (diffDays > 1)
    return { label: `In ${diffDays}d`, kind: "upcoming", diffDays, parsed };
  return { label: "Done", kind: "done", diffDays, parsed };
}
