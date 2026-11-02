import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCalendarMonths,
  parseCalendarDays,
  calendarMonthKey,
} from "../lib/calendar.js";
import { monthGrid, moveMonth } from "../src/calendar-utils.js";
test("calendar month tokens are deduplicated and validated", () => {
  const html = `<button onclick="processViewCalendar('01-OCT-2026')">October</button><button onclick="processViewCalendar('01-OCT-2026')">October</button><button onclick="processViewCalendar('01-NOV-2026')">November</button>`;
  assert.deepEqual(parseCalendarMonths(html), ["01-OCT-2026", "01-NOV-2026"]);
  assert.equal(calendarMonthKey("01-OCT-2026"), "2026-10");
  assert.equal(calendarMonthKey("01-XYZ-2026"), null);
  assert.throws(() => parseCalendarMonths("<html>Maintenance</html>"), {
    code: "CALENDAR_UNAVAILABLE",
  });
});
test("calendar separates instructional days, holidays, and day-order overrides", () => {
  const html = `<table class="calendar-table"><tr><td><span>29</span><span>Instructional Day</span><span>(MONDAY Day Order)</span><span>(MONDAY Day Order)</span></td><td><span>30</span><span>No Instructional Day</span><span>(Holiday)</span><span>(Holiday)</span></td></tr></table>`;
  assert.deepEqual(parseCalendarDays(html, "01-OCT-2026"), [
    {
      date: "2026-10-29",
      instructional: true,
      label: "MONDAY Day Order",
      dayOrder: "Monday",
    },
    {
      date: "2026-10-30",
      instructional: false,
      label: "Holiday",
      dayOrder: null,
    },
  ]);
  assert.throws(() => parseCalendarDays("<html>Login</html>", "01-OCT-2026"), {
    code: "CALENDAR_UNAVAILABLE",
  });
});
test("calendar dates reject impossible month days and support leap years", () => {
  const html =
    '<div id="list-wrapper"><table><tr><td><span>29</span><span>Instructional Day</span></td></tr></table></div>';
  assert.equal(parseCalendarDays(html, "01-FEB-2024")[0].date, "2024-02-29");
  assert.throws(() => parseCalendarDays(html, "01-FEB-2026"), {
    code: "CALENDAR_UNAVAILABLE",
  });
});
test("phone calendar starts on Monday and moves across years correctly", () => {
  const cells = monthGrid("2026-10");
  assert.deepEqual(cells.slice(0, 4), [null, null, null, "2026-10-01"]);
  assert.equal(cells.at(-1), "2026-10-31");
  assert.equal(moveMonth("2026-12", 1), "2027-01");
  assert.equal(moveMonth("2026-01", -1), "2025-12");
});
