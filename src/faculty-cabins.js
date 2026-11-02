const normalize = (value = "") =>
  value
    .toUpperCase()
    .replace(/^(DR|PROF)\.?\s+/, "")
    .replace(/[^A-Z0-9]/g, "");

// Require the complete name and, when supplied, the same school. No fuzzy guesses.
export function findFacultyCabin(faculty, directory) {
  const [name, school] = (faculty || "").split(/\s+[-–]\s+/);
  if (!normalize(name)) return null;
  const matches = directory.filter(
    (entry) =>
      normalize(entry.name) === normalize(name) &&
      (!school || normalize(entry.school) === normalize(school)),
  );
  const cabins = [
    ...new Set(matches.map((entry) => entry.cabin).filter(Boolean)),
  ];
  return cabins.length === 1 ? cabins[0] : null;
}
