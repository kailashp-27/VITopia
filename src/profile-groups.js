const baseTitle = (title = "") =>
  title
    .replace(/\s*[-–:(]*\s*\b(lab|laboratory)\s*\)?\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function groupCourses(courses) {
  const groups = new Map();
  for (const course of courses) {
    const key = baseTitle(course.title) || course.code;
    if (!groups.has(key))
      groups.set(key, { title: course.title || course.code, items: [] });
    const group = groups.get(key);
    group.items.push(course);
    if (
      !/lab/i.test(course.type || "") &&
      !/\b(lab|laboratory)\s*$/i.test(course.title || "")
    )
      group.title = course.title || course.code;
  }
  return [...groups.values()];
}

export function groupExams(items) {
  const groups = new Map();
  for (const exam of items) {
    const raw = (exam.examType || "Examinations").trim();
    const cat = raw.match(
      /(?:\bCAT|Continuous Assessment Test)\s*[-–:]?\s*(III|II|IV|I|[1-4])\b/i,
    );
    const number =
      cat && ({ I: 1, II: 2, III: 3, IV: 4 }[cat[1].toUpperCase()] || cat[1]);
    const title = cat
      ? `CAT ${number}`
      : /\bFAT\b|Final Assessment Test|Term End Exam/i.test(raw)
        ? "FAT"
        : raw;
    if (!groups.has(title)) groups.set(title, { title, items: [] });
    groups.get(title).items.push(exam);
  }
  return [...groups.values()].sort((a, b) => {
    const rank = (title) =>
      /^CAT [1-4]$/.test(title)
        ? Number(title.slice(-1))
        : title === "FAT"
          ? 5
          : 6;
    return rank(a.title) - rank(b.title);
  });
}
