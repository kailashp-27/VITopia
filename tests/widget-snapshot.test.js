import test from "node:test";
import assert from "node:assert/strict";
import { buildWidgetSnapshot } from "../src/widget-snapshot.js";

test("buildWidgetSnapshot returns empty state with theme when data is missing or demoMode is active", () => {
  const empty = buildWidgetSnapshot({
    data: null,
    demoMode: false,
    themeId: "midnight-azure",
  });
  assert.equal(empty.hasData, false);
  assert.equal(empty.timetableAvailable, false);
  assert.equal(empty.examsAvailable, false);
  assert.equal(empty.classes.length, 0);
  assert.equal(empty.theme.id, "midnight-azure");
  assert.equal(empty.theme.isLight, false);

  const demoSnap = buildWidgetSnapshot({
    data: { attendance: [{ code: "BCSE101L" }] },
    demoMode: true,
    themeId: "matte-ivory",
  });
  assert.equal(demoSnap.hasData, false);
  assert.equal(demoSnap.theme.id, "matte-ivory");
  assert.equal(demoSnap.theme.isLight, true);
});

test("buildWidgetSnapshot enriches classes, calendar overrides, and exams", () => {
  const snapshot = buildWidgetSnapshot({
    themeId: "amoled-black",
    data: {
      syncedAt: "2026-11-10T10:00:00.000Z",
      attendance: [
        {
          code: "BCSE302L",
          title: "Database Systems",
          attended: 14,
          total: 20,
          percent: 70,
          slot: "A1+TA1",
        },
        {
          code: "BMAT201L",
          title: "Complex Variables",
          attended: 18,
          total: 20,
          percent: 90,
          slot: "B1+TB1",
        },
      ],
      overview: {
        timetable: {
          available: true,
          classes: [
            {
              day: "MON",
              start: "10:00",
              end: "10:50",
              code: "BMAT201L",
              slot: "B1",
              venue: "AB1-202",
              type: "Theory",
            },
            {
              day: "MON",
              start: "08:00",
              end: "08:50",
              code: "BCSE302L",
              slot: "A1",
              venue: "AB3-301",
              type: "Theory",
            },
          ],
        },
        exams: {
          available: true,
          items: [
            {
              examType: "Continuous Assessment Test - II",
              code: "BCSE302L",
              date: "18-Nov-2026",
              time: "09:30 AM - 11:00 AM",
              venue: "AB1",
              location: "305",
              seat: "14",
              slot: "A1",
            },
          ],
        },
      },
      calendar: {
        days: [
          {
            date: "2026-11-14",
            instructional: true,
            dayOrder: "Monday",
            label: "Monday day order",
          },
          {
            date: "2026-11-15",
            instructional: true,
            label: "Diwali Holiday",
          },
        ],
      },
    },
  });

  assert.equal(snapshot.hasData, true);
  assert.equal(snapshot.classes.length, 2);
  assert.equal(snapshot.classes[0].start, "08:00");
  assert.equal(snapshot.classes[0].title, "Database Systems");
  assert.equal(snapshot.classes[0].attendancePct, "70.0");
  assert.equal(snapshot.classes[0].attendanceWarning, true);
  assert.equal(snapshot.classes[1].attendanceWarning, false);

  assert.deepEqual(snapshot.calendarDays, [
    {
      date: "2026-11-14",
      status: "working",
      dayOrder: "MON",
      label: "Monday day order",
    },
    {
      date: "2026-11-15",
      status: "holiday",
      dayOrder: "",
      label: "Diwali Holiday",
    },
  ]);

  assert.equal(snapshot.exams.length, 1);
  assert.equal(snapshot.exams[0].examType, "CAT 2");
  assert.equal(snapshot.exams[0].title, "Database Systems");
  assert.equal(snapshot.exams[0].venue, "AB1 - 305");
  assert.equal(snapshot.exams[0].seat, "Seat 14");
});
