import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCalendarMonths,
  parseCalendarDays,
  calendarMonthKey,
} from "../lib/calendar.js";
import {
  DEFAULT_CALENDAR_CATEGORY,
  classifyCalendarSegment,
  filterCalendarForCategory,
  monthGrid,
  moveMonth,
  resolveDayForCategory,
  workingSaturdaysForMonth,
} from "../src/calendar-utils.js";
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

test("calendar category classifier distinguishes General, General Flexible, and Fresher without overlap", () => {
  assert.equal(DEFAULT_CALENDAR_CATEGORY, "general");
  assert.deepEqual(
    classifyCalendarSegment("General Flexible - Wednesday Day Order"),
    ["general-flexible"],
  );
  assert.deepEqual(
    classifyCalendarSegment("General Freshers - Thursday Day Order"),
    ["fresher"],
  );
  assert.deepEqual(
    classifyCalendarSegment("Fresher - Friday Order"),
    ["fresher"],
  );
  assert.deepEqual(
    classifyCalendarSegment("General - Monday Day Order"),
    ["general"],
  );
  assert.deepEqual(
    classifyCalendarSegment("General, General Flexible - Tuesday Day Order"),
    ["general-flexible", "general"],
  );
  assert.deepEqual(classifyCalendarSegment("Diwali Holiday"), []);
});

test("resolveDayForCategory and workingSaturdaysForMonth filter Saturdays and day orders per category", () => {
  const calendar = {
    months: ["2026-11"],
    days: [
      {
        date: "2026-11-06",
        instructional: false,
        label: "Diwali Holiday",
        dayOrder: null,
      },
      {
        date: "2026-11-07",
        instructional: true,
        label:
          "General - Wednesday Day Order / General Flexible - Holiday / Fresher - Thursday Day Order",
        dayOrder: "Wednesday",
      },
      {
        date: "2026-11-14",
        instructional: true,
        label: "General Flexible - Wednesday Order",
        dayOrder: "Wednesday",
      },
      {
        date: "2026-11-21",
        instructional: true,
        label:
          "General - Thursday Day Order / General Flexible - Thursday Day Order / Fresher - Holiday",
        dayOrder: "Thursday",
      },
      {
        date: "2026-11-28",
        instructional: true,
        label: "General Freshers - Friday Day Order",
        dayOrder: "Friday",
      },
    ],
  };

  // Universal holiday applies to all categories
  assert.equal(
    resolveDayForCategory(calendar.days[0], "general-flexible").status,
    "holiday",
  );

  // Nov 7: working for General (Wed) & Fresher (Thu), holiday for General Flexible
  assert.equal(resolveDayForCategory(calendar.days[1], "general").status, "working");
  assert.equal(resolveDayForCategory(calendar.days[1], "general").dayOrder, "Wednesday");
  assert.equal(resolveDayForCategory(calendar.days[1], "general-flexible").status, "holiday");
  assert.equal(resolveDayForCategory(calendar.days[1], "fresher").status, "working");
  assert.equal(resolveDayForCategory(calendar.days[1], "fresher").dayOrder, "Thursday");

  // Nov 14: only General Flexible is working (Wed); General & Fresher get holiday
  assert.equal(resolveDayForCategory(calendar.days[2], "general-flexible").status, "working");
  assert.equal(resolveDayForCategory(calendar.days[2], "general-flexible").dayOrder, "Wednesday");
  assert.equal(resolveDayForCategory(calendar.days[2], "general").status, "holiday");
  assert.equal(resolveDayForCategory(calendar.days[2], "fresher").status, "holiday");

  // Working Saturdays per category
  assert.deepEqual(
    workingSaturdaysForMonth(calendar, "2026-11", "general").map((d) => [
      d.date,
      d.dayOrder,
    ]),
    [
      ["2026-11-07", "Wednesday"],
      ["2026-11-21", "Thursday"],
    ],
  );
  assert.deepEqual(
    workingSaturdaysForMonth(calendar, "2026-11", "general-flexible").map((d) => [
      d.date,
      d.dayOrder,
    ]),
    [
      ["2026-11-14", "Wednesday"],
      ["2026-11-21", "Thursday"],
    ],
  );
  assert.deepEqual(
    workingSaturdaysForMonth(calendar, "2026-11", "fresher").map((d) => [
      d.date,
      d.dayOrder,
    ]),
    [
      ["2026-11-07", "Thursday"],
      ["2026-11-28", "Friday"],
    ],
  );

  const filtered = filterCalendarForCategory(calendar, "general-flexible");
  assert.equal(filtered.category, "general-flexible");
  assert.equal(filtered.days.length, 5);
});
