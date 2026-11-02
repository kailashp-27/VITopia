export const marksCourseKey = (course) => `${course.code}|${course.type || ""}`;
const componentKey = (component) =>
  (component.name || "").trim().toLowerCase().replace(/\s+/g, " ");

export function newMarksCourses(previous, next) {
  // First sync establishes a baseline; semesters have independent assessments.
  if (
    !previous ||
    !previous.semester?.id ||
    previous.semester.id !== next.semester?.id
  )
    return [];
  const before = new Map(
    (previous.marks || []).map((course) => [marksCourseKey(course), course]),
  );
  return (next.marks || [])
    .filter((course) => {
      const old = new Map(
        (before.get(marksCourseKey(course))?.components || []).map(
          (component) => [componentKey(component), component],
        ),
      );
      return course.components.some((component) => {
        if (!Number.isFinite(component.scored)) return false;
        const prior = old.get(componentKey(component));
        return (
          !prior ||
          !Number.isFinite(prior.scored) ||
          prior.scored !== component.scored
        );
      });
    })
    .map(marksCourseKey);
}

export function unreadMarksCourses(previous, next) {
  const changed = newMarksCourses(previous, next);
  const sameSemester =
    previous?.semester?.id && previous.semester.id === next.semester?.id;
  const present = new Set((next.marks || []).map(marksCourseKey));
  return [
    ...new Set([
      ...(sameSemester ? previous.unreadMarks || [] : []),
      ...changed,
    ]),
  ].filter((key) => present.has(key));
}
