export function attendancePlan(attended, total, target = 75) {
  if (
    !Number.isInteger(attended) ||
    !Number.isInteger(total) ||
    attended < 0 ||
    total < attended ||
    target <= 0 ||
    target >= 100
  )
    throw new RangeError("Invalid attendance inputs");
  const percent = total ? (attended / total) * 100 : null;
  const skip = Math.max(
    0,
    Math.floor((100 * attended - target * total) / target),
  );
  const attend = Math.max(
    0,
    Math.ceil((target * total - 100 * attended) / (100 - target)),
  );
  return { percent, skip, attend };
}
export function overallAttendance(courses) {
  const attended = courses.reduce((s, c) => s + c.attended, 0);
  const total = courses.reduce((s, c) => s + c.total, 0);
  return { attended, total, percent: total ? (attended / total) * 100 : null };
}
export function projectAttendance(
  attended,
  total,
  attend = 0,
  miss = 0,
  target = 75,
) {
  if (![attend, miss].every((n) => Number.isInteger(n) && n >= 0 && n <= 10))
    throw new RangeError("Choose between zero and ten classes for each slider");
  attendancePlan(attended, total, target);
  const projectedAttended = attended + attend;
  const projectedTotal = total + attend + miss;
  return {
    attended: projectedAttended,
    total: projectedTotal,
    ...attendancePlan(projectedAttended, projectedTotal, target),
  };
}
export function weightedMarks(components) {
  const published = components.filter(
    (c) => c.scored !== null && c.max > 0 && c.weight !== null,
  );
  return {
    scored: published.reduce((s, c) => s + (c.scored / c.max) * c.weight, 0),
    outOf: published.reduce((s, c) => s + c.weight, 0),
  };
}
