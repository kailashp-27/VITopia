import test from "node:test";
import assert from "node:assert/strict";
import {
  datesInRange,
  daySimulationState,
  nextAttendanceStatus,
  simulationDays,
  simulateAttendance,
  attendanceUnits,
} from "../src/simulator.js";
const courses = [
  { code: "A", title: "Theory", attended: 24, total: 30 },
  { code: "B", title: "Lab", attended: 16, total: 20 },
];
const data = {
  attendance: courses,
  overview: {
    timetable: {
      available: true,
      classes: [
        {
          day: "MON",
          code: "A",
          type: "Theory",
          slot: "A1",
          start: "08:00",
          end: "08:50",
        },
        {
          day: "MON",
          code: "B",
          type: "Lab",
          slot: "L1+L2",
          start: "10:00",
          end: "11:40",
        },
        {
          day: "TUE",
          code: "A",
          type: "Theory",
          slot: "TA1",
          start: "09:00",
          end: "09:50",
        },
      ],
    },
  },
};
test("mixed day projection counts lab periods and weights overall by attendance totals", () => {
  const original = structuredClone(data);
  const days = simulationDays(data, ["2026-11-09"]);
  const choices = {
    [days[0].classes[0].key]: "present",
    [days[0].classes[1].key]: "absent",
  };
  const result = simulateAttendance(courses, days, choices);
  assert.equal(result.courses[0].attended, 25);
  assert.equal(result.courses[0].total, 31);
  assert.equal(result.courses[1].attended, 16);
  assert.equal(result.courses[1].total, 22);
  assert.equal(result.after.percent, (41 / 53) * 100);
  assert.equal(result.present, 1);
  assert.equal(result.absent, 2);
  assert.deepEqual(data, original);
});
test("week combines courses across days; ignoring a day removes only that day's changes", () => {
  const days = simulationDays(data, ["2026-11-09", "2026-11-10"]);
  let choices = Object.fromEntries(
    days.flatMap((day) => day.classes.map((item) => [item.key, "present"])),
  );
  assert.equal(simulateAttendance(courses, days, choices).present, 4);
  choices = {
    ...choices,
    ...Object.fromEntries(days[0].classes.map((item) => [item.key, "ignore"])),
  };
  const result = simulateAttendance(courses, days, choices);
  assert.equal(result.present, 1);
  assert.equal(result.courses[0].attended, 25);
  assert.equal(result.courses[1].attended, 16);
});
test("holiday overrides, missing attendance and unavailable lab periods cannot alter totals", () => {
  const closed = {
    ...data,
    calendar: {
      days: [{ date: "2026-11-09", label: "Holiday", instructional: true }],
    },
  };
  assert.equal(simulationDays(closed, ["2026-11-09"])[0].classes.length, 0);
  const unknown = simulationDays({ ...data, attendance: [] }, ["2026-11-09"]);
  const choices = Object.fromEntries(
    unknown[0].classes.map((item) => [item.key, "present"]),
  );
  assert.equal(simulateAttendance(courses, unknown, choices).present, 0);
  assert.equal(attendanceUnits({ type: "Lab", slot: "" }), null);
  assert.equal(attendanceUnits({ type: "Lab", periods: 3 }), 3);
  assert.deepEqual(
    simulateAttendance(
      courses,
      simulationDays(data, ["2026-11-09"]),
      Object.fromEntries(
        simulationDays(data, ["2026-11-09"])[0].classes.map((item) => [
          item.key,
          "ignore",
        ]),
      ),
    ).after,
    { attended: 40, total: 50, percent: 80 },
  );
});
test("new plans default all classes to present and class taps cycle every state", () => {
  const days = simulationDays(data, ["2026-11-09", "2026-11-10"]);
  const result = simulateAttendance(courses, days, {});
  assert.equal(result.present, 4);
  assert.equal(result.absent, 0);
  assert.equal(nextAttendanceStatus(), "absent");
  assert.equal(nextAttendanceStatus("absent"), "ignore");
  assert.equal(nextAttendanceStatus("ignore"), "present");
  const choices = Object.fromEntries(
    days[0].classes.map((item) => [item.key, "ignore"]),
  );
  assert.equal(simulateAttendance(courses, days, choices).present, 1);
});
test("Saturday day orders use the replacement day's classes and zero totals stay defined", () => {
  const special = {
    ...data,
    calendar: {
      days: [{ date: "2026-11-14", instructional: true, dayOrder: "MON" }],
    },
  };
  assert.equal(simulationDays(special, ["2026-11-14"])[0].classes.length, 2);
  assert.equal(simulateAttendance([], [], {}).after.percent, null);
});

test("datesInRange builds inclusive multi-day ranges across month boundaries and caps safely", () => {
  assert.deepEqual(datesInRange("2026-11-18", "2026-11-18"), ["2026-11-18"]);
  assert.deepEqual(datesInRange("2026-11-29", "2026-12-02"), [
    "2026-11-29",
    "2026-11-30",
    "2026-12-01",
    "2026-12-02",
  ]);
  assert.deepEqual(datesInRange("2026-11-20", "2026-11-18"), []);
  assert.equal(datesInRange("2026-11-01", "2027-02-01", 10).length, 10);
  assert.deepEqual(datesInRange("bad", "2026-11-20"), []);
});

test("daySimulationState classifies all-present, all-absent, all-ignore, mixed, and empty days", () => {
  const [monday] = simulationDays(data, ["2026-11-09"]);
  assert.equal(daySimulationState(monday, {}), "all-present");
  assert.equal(
    daySimulationState(monday, {
      [monday.classes[0].key]: "absent",
      [monday.classes[1].key]: "absent",
    }),
    "all-absent",
  );
  assert.equal(
    daySimulationState(monday, {
      [monday.classes[0].key]: "ignore",
      [monday.classes[1].key]: "ignore",
    }),
    "all-ignore",
  );
  assert.equal(
    daySimulationState(monday, {
      [monday.classes[0].key]: "present",
      [monday.classes[1].key]: "absent",
    }),
    "mixed",
  );
  const [sunday] = simulationDays(data, ["2026-11-08"]);
  assert.equal(daySimulationState(sunday, {}), "empty");
});

test("simulationDays respects current IST time on today and omits finished today when requested", () => {
  const timedData = {
    attendance: courses,
    overview: {
      timetable: {
        available: true,
        classes: [
          { day: "MON", code: "A", type: "Theory", slot: "A1", start: "08:00", end: "08:50" },
          { day: "MON", code: "B", type: "Lab", slot: "L1+L2", start: "14:00", end: "15:40" },
          { day: "TUE", code: "A", type: "Theory", slot: "TA1", start: "09:00", end: "09:50" },
        ],
      },
    },
  };

  // At 1:00 PM (780 min) on Monday 2026-11-09: only the 14:00 lab remains on Monday
  const atOnePm = simulationDays(timedData, ["2026-11-09", "2026-11-10"], {
    today: "2026-11-09",
    nowMinutes: 13 * 60,
    omitFinishedToday: true,
  });
  assert.equal(atOnePm.length, 2);
  assert.deepEqual(
    atOnePm[0].classes.map((c) => c.start),
    ["14:00"],
  );
  assert.equal(atOnePm[1].classes.length, 1);

  // At 7:00 PM (1140 min) on Monday 2026-11-09: Monday is omitted completely
  const atSevenPm = simulationDays(timedData, ["2026-11-09", "2026-11-10"], {
    today: "2026-11-09",
    nowMinutes: 19 * 60,
    omitFinishedToday: true,
  });
  assert.equal(atSevenPm.length, 1);
  assert.equal(atSevenPm[0].date, "2026-11-10");
});
