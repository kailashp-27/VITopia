import { attendancePlan } from "./calc.js";

export function attendanceTier(percent, target = 75) {
  if (percent === null || !Number.isFinite(percent)) return "neutral";
  if (percent < target) return "danger";
  if (percent <= 80) return "warning";
  return "good";
}

export function formatMargin(plan, total) {
  if (!total) return "(—)";
  if (plan.attend > 0) return `(-${plan.attend})`;
  if (plan.skip > 0) return `(+${plan.skip})`;
  return "(±0)";
}

export function courseStatusSummary(course, target = 75) {
  const attended = Number(course?.attended) || 0;
  const total = Number(course?.total) || 0;
  const plan = attendancePlan(attended, total, target);
  const percent = total > 0 ? (attended / total) * 100 : null;
  const tier = attendanceTier(percent, target);
  const statusLabel =
    tier === "good"
      ? "Safe"
      : tier === "warning"
        ? "Borderline"
        : tier === "danger"
          ? "At risk"
          : "No data";
  return {
    attended,
    total,
    percent,
    tier,
    plan,
    marginLabel: formatMargin(plan, total),
    statusLabel,
  };
}

export function buildAttendanceMatrix(
  course,
  { maxAttend = 5, maxMiss = 5, target = 75 } = {},
) {
  const baseAttended = Number(course?.attended) || 0;
  const baseTotal = Number(course?.total) || 0;
  const rows = [];

  for (let miss = 0; miss <= maxMiss; miss++) {
    const cells = [];
    for (let attend = 0; attend <= maxAttend; attend++) {
      const attended = baseAttended + attend;
      const total = baseTotal + attend + miss;
      const plan = attendancePlan(attended, total, target);
      const percent = total > 0 ? (attended / total) * 100 : null;
      const tier = attendanceTier(percent, target);
      cells.push({
        miss,
        attend,
        attended,
        total,
        percent,
        tier,
        plan,
        margin: plan.attend > 0 ? -plan.attend : plan.skip,
        marginLabel: formatMargin(plan, total),
        isCurrent: miss === 0 && attend === 0,
      });
    }
    rows.push({ miss, cells });
  }
  return rows;
}
