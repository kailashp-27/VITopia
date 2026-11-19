import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttendanceMatrix,
  courseStatusSummary,
} from "../src/attendance-matrix.js";

test("courseStatusSummary classifies Safe, Borderline, and At risk courses with margin labels", () => {
  const safe = courseStatusSummary({ attended: 22, total: 26 });
  assert.equal(safe.statusLabel, "Safe");
  assert.equal(safe.tier, "good");
  assert.equal(safe.marginLabel, "(+3)");
  assert.equal(Number(safe.percent.toFixed(1)), 84.6);

  const borderline = courseStatusSummary({ attended: 24, total: 31 });
  assert.equal(borderline.statusLabel, "Borderline");
  assert.equal(borderline.tier, "warning");

  const atRisk = courseStatusSummary({ attended: 20, total: 30 });
  assert.equal(atRisk.statusLabel, "At risk");
  assert.equal(atRisk.tier, "danger");
  assert.equal(atRisk.marginLabel, "(-10)");
});

test("buildAttendanceMatrix builds 6x6 attend/absent grid with accurate percentages, margins, and tiers", () => {
  const rows = buildAttendanceMatrix({ attended: 22, total: 26 });
  assert.equal(rows.length, 6);
  assert.equal(rows[0].cells.length, 6);

  // (miss 0, attend 0) -> current cell 22/26 = 84.6% (+3) good
  const current = rows[0].cells[0];
  assert.equal(current.isCurrent, true);
  assert.equal(Number(current.percent.toFixed(1)), 84.6);
  assert.equal(current.marginLabel, "(+3)");
  assert.equal(current.tier, "good");

  // (miss 3, attend 0) -> 22/29 = 75.9% (±0) warning
  const marginCell = rows[3].cells[0];
  assert.equal(marginCell.attended, 22);
  assert.equal(marginCell.total, 29);
  assert.equal(marginCell.marginLabel, "(±0)");
  assert.equal(marginCell.tier, "warning");

  // (miss 4, attend 0) -> 22/30 = 73.3% (-2) danger
  const dangerCell = rows[4].cells[0];
  assert.equal(dangerCell.attended, 22);
  assert.equal(dangerCell.total, 30);
  assert.equal(Number(dangerCell.percent.toFixed(1)), 73.3);
  assert.equal(dangerCell.marginLabel, "(-2)");
  assert.equal(dangerCell.tier, "danger");

  // (miss 0, attend 5) -> 27/31 = 87.1% (+5) good
  const bestCell = rows[0].cells[5];
  assert.equal(bestCell.attended, 27);
  assert.equal(bestCell.total, 31);
  assert.equal(bestCell.marginLabel, "(+5)");
  assert.equal(bestCell.tier, "good");
});
