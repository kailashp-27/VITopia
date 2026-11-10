import test from "node:test";
import assert from "node:assert/strict";
import {
  formatExamType,
  getExamCountdown,
  parseExamDate,
} from "../src/exam-utils.js";

test("parseExamDate and formatExamType normalize VTOP exam entries", () => {
  const parsed = parseExamDate("20-NOV-2026", "09:00 - 12:00");
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 20);
  assert.equal(parsed.getHours(), 9);

  assert.equal(parseExamDate("Pending"), null);
  assert.equal(formatExamType("CAT - II"), "CAT 2");
  assert.equal(formatExamType("Final Assessment Test"), "FAT");
});

test("getExamCountdown computes Today, Tomorrow, In Xd, and Done labels", () => {
  const now = new Date(2026, 10, 10, 12, 0, 0);

  assert.equal(getExamCountdown("10-NOV-2026", "09:00 - 10:30", now)?.label, "Today");
  assert.equal(getExamCountdown("10-NOV-2026", "09:00 - 10:30", now)?.kind, "soon");

  assert.equal(getExamCountdown("11-NOV-2026", "14:00 - 15:30", now)?.label, "Tomorrow");
  assert.equal(getExamCountdown("14-NOV-2026", "09:00 - 12:00", now)?.label, "In 4d");
  assert.equal(getExamCountdown("14-NOV-2026", "09:00 - 12:00", now)?.kind, "upcoming");

  assert.equal(getExamCountdown("08-NOV-2026", "09:00 - 10:30", now)?.label, "Done");
  assert.equal(getExamCountdown("08-NOV-2026", "09:00 - 10:30", now)?.kind, "done");
});
