import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAttendanceDetails,
  parseODDetails,
} from "../lib/overview-parsers.js";
import { fetchOverview } from "../lib/overview.js";
import {
  collectOdItems,
  findCourseHistory,
  findNextCourseClasses,
  parseVtopDateMs,
  projectCourseMiniSim,
  sortRecordsNewestFirst,
  summarizeAttendanceRecords,
} from "../src/attendance-history.js";

test("parseAttendanceDetails extracts date-wise Present, Absent, and On Duty records while keeping parseODDetails compatible", () => {
  const html = `
    <table>
      <thead>
        <tr>
          <th>Sl.No.</th>
          <th>Date</th>
          <th>Slot</th>
          <th>Day And Timing</th>
          <th>Attendance Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>1</td><td>02-Nov-2026</td><td>A1</td><td>MON, 08:00 - 08:50</td><td>Present</td></tr>
        <tr><td>2</td><td>04-Nov-2026</td><td>A1</td><td>WED, 09:00 - 09:50</td><td>Absent</td></tr>
        <tr><td>3</td><td>06-Nov-2026</td><td>TA1</td><td>FRI, 10:00 - 11:40</td><td>On Duty (Hackathon)</td></tr>
        <tr><td>4</td><td>09-Nov-2026</td><td>A1</td><td>MON, 08:00 - 08:50</td><td>Cancelled</td></tr>
      </tbody>
    </table>
  `;

  const detail = parseAttendanceDetails(html);
  assert.equal(detail.entries, 1);
  assert.equal(detail.recorded, 3);
  assert.equal(detail.hours, 2);
  assert.equal(detail.records.length, 3);
  assert.deepEqual(detail.records[0], {
    date: "02-Nov-2026",
    slot: "A1",
    day: "",
    timing: "MON, 08:00 - 08:50",
    status: "Present",
    kind: "present",
    rawStatus: "Present",
    hours: 1,
  });
  assert.equal(detail.records[1].kind, "absent");
  assert.equal(detail.records[2].kind, "od");
  assert.equal(detail.records[2].hours, 2);
  assert.equal(detail.records[2].rawStatus, "On Duty (Hackathon)");

  assert.deepEqual(parseODDetails(html), {
    entries: 1,
    recorded: 3,
    hours: 2,
  });
});

test("fetchOverview populates attendanceHistory.byCourse alongside OD totals", async () => {
  const client = {
    authenticated: async (path, payload) => {
      if (path === "processViewStudentAttendance") {
        return `<table>
          <tr><td>BCSE302L</td><td><button onclick="processViewAttendanceDetail('C1','A1')">View</button></td></tr>
          <tr><td>BCSE302P</td><td><button onclick="processViewAttendanceDetail('C2','L3+L4')">View</button></td></tr>
        </table>`;
      }
      if (path === "processViewAttendanceDetail") {
        if (payload.classId === "C1") {
          return `<table><tr><th>Date</th><th>Day And Timing</th><th>Status</th></tr>
            <tr><td>02-Nov-2026</td><td>08:00 - 08:50</td><td>Present</td></tr>
            <tr><td>04-Nov-2026</td><td>08:00 - 08:50</td><td>Absent</td></tr></table>`;
        }
        return `<table><tr><th>Date</th><th>Day And Timing</th><th>Status</th></tr>
          <tr><td>03-Nov-2026</td><td>09:50 - 11:30</td><td>On Duty</td></tr></table>`;
      }
      return "";
    },
  };

  const result = await fetchOverview(client, "SEM2026");
  assert.equal(result.attendanceHistory.available, true);
  assert.equal(result.attendanceHistory.byCourse["BCSE302L::A1"].records.length, 2);
  assert.equal(result.attendanceHistory.byCourse["BCSE302P::L3+L4"].records.length, 1);
  assert.equal(result.attendanceHistory.byCourse["BCSE302P::L3+L4"].records[0].kind, "od");
  assert.equal(result.ods.hours, 2);
});

test("findCourseHistory resolves exact, whitespace-normalized, and lab/theory embedded matches", () => {
  const history = {
    available: true,
    byCourse: {
      "BCSE301E::A1+TA1": { code: "BCSE301E", slot: "A1+TA1", records: [{ kind: "present" }] },
      "BCSE301E::L31+L32": { code: "BCSE301E", slot: "L31+L32", records: [{ kind: "od" }] },
      "BMAT201L::C1": { code: "BMAT201L", slot: "C1", records: [{ kind: "absent" }] },
    },
  };

  assert.equal(
    findCourseHistory({ code: "BCSE301E", slot: "A1 + TA1", type: "Embedded Theory" }, history)?.slot,
    "A1+TA1",
  );
  assert.equal(
    findCourseHistory({ code: "BCSE301E", slot: "", type: "Embedded Lab" }, history)?.slot,
    "L31+L32",
  );
  assert.equal(
    findCourseHistory({ code: "BMAT201L", slot: "", type: "Theory" }, history)?.slot,
    "C1",
  );
  assert.equal(findCourseHistory({ code: "UNKNOWN101", slot: "F1" }, history), null);
});

test("sortRecordsNewestFirst sorts VTOP dates descending and summarizeAttendanceRecords counts statuses", () => {
  assert.equal(parseVtopDateMs("13-Nov-2026"), Date.UTC(2026, 10, 13));
  assert.equal(parseVtopDateMs("2026-11-02"), Date.UTC(2026, 10, 2));

  const sorted = sortRecordsNewestFirst([
    { date: "02-Nov-2026", kind: "present" },
    { date: "13-Nov-2026", kind: "od" },
    { date: "09-Nov-2026", kind: "absent" },
  ]);
  assert.deepEqual(
    sorted.map((r) => r.date),
    ["13-Nov-2026", "09-Nov-2026", "02-Nov-2026"],
  );
  assert.deepEqual(summarizeAttendanceRecords(sorted), {
    present: 1,
    absent: 1,
    od: 1,
    total: 3,
  });
});

test("fetchOverview populates ods.items and collectOdItems enriches titles and sorts newest-first", async () => {
  const client = {
    authenticated: async (path, payload) => {
      if (path === "processViewStudentAttendance") {
        return `<table>
          <tr><td>BCSE302L</td><td><button onclick="processViewAttendanceDetail('C1','A1')">View</button></td></tr>
          <tr><td>BCSE302P</td><td><button onclick="processViewAttendanceDetail('C2','L3+L4')">View</button></td></tr>
        </table>`;
      }
      if (path === "processViewAttendanceDetail") {
        if (payload.classId === "C1") {
          return `<table><tr><th>Date</th><th>Day And Timing</th><th>Status</th></tr>
            <tr><td>02-Nov-2026</td><td>08:00 - 08:50</td><td>On Duty (Seminar)</td></tr></table>`;
        }
        return `<table><tr><th>Date</th><th>Day And Timing</th><th>Status</th></tr>
          <tr><td>10-Nov-2026</td><td>09:50 - 11:30</td><td>On Duty</td></tr></table>`;
      }
      return "";
    },
  };

  const overview = await fetchOverview(client, "SEM2026");
  assert.equal(overview.ods.available, true);
  assert.equal(overview.ods.hours, 3);
  assert.equal(overview.ods.items.length, 2);

  const items = collectOdItems({
    attendance: [
      { code: "BCSE302L", title: "Database Management Systems" },
      { code: "BCSE302P", title: "Database Management Systems Lab" },
    ],
    overview,
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].date, "10-Nov-2026");
  assert.equal(items[0].courseTitle, "Database Management Systems Lab");
  assert.equal(items[0].hours, 2);
  assert.equal(items[1].date, "02-Nov-2026");
  assert.equal(items[1].courseTitle, "Database Management Systems");
  assert.equal(items[1].status, "On Duty (Seminar)");

  // Fallback derivation from attendanceHistory when ods.items is absent
  const derived = collectOdItems({
    attendance: [{ code: "BCSE302L", title: "Database Management Systems" }],
    overview: {
      ods: { available: true, hours: 1 },
      attendanceHistory: overview.attendanceHistory,
    },
  });
  assert.equal(derived.length, 2);
  assert.equal(derived[0].date, "10-Nov-2026");
});

test("findNextCourseClasses finds next 3 upcoming classes respecting time and projectCourseMiniSim defaults to ignore", () => {
  const timetable = {
    available: true,
    classes: [
      { day: "MON", code: "BCSE302L", type: "Theory", slot: "A1", start: "08:00", end: "08:50" },
      { day: "WED", code: "BCSE302L", type: "Theory", slot: "A1", start: "09:00", end: "09:50" },
      { day: "FRI", code: "BCSE302L", type: "Theory", slot: "TA1", start: "10:00", end: "10:50" },
      { day: "TUE", code: "BCSE302P", type: "Lab", slot: "L3+L4", start: "09:50", end: "11:30" },
    ],
  };
  const course = { code: "BCSE302L", type: "Theory", attended: 24, total: 32 };

  // Monday 2026-11-09 at 10:00 AM -> 08:00 Monday is skipped; next 3 are Wed Nov 11, Fri Nov 13, Mon Nov 16
  const next3 = findNextCourseClasses(course, timetable, null, {
    count: 3,
    today: "2026-11-09",
    nowMinutes: 10 * 60,
  });
  assert.deepEqual(
    next3.map((c) => c.date),
    ["2026-11-11", "2026-11-13", "2026-11-16"],
  );

  // Default all ignore -> unchanged 75.0%
  const base = projectCourseMiniSim(course, next3, {});
  assert.equal(base.hasChanges, false);
  assert.equal(base.attended, 24);
  assert.equal(base.total, 32);
  assert.equal(base.percent, 75);

  // Mark 2 present, 1 absent -> 26 / 35
  const simulated = projectCourseMiniSim(course, next3, {
    [next3[0].key]: "present",
    [next3[1].key]: "present",
    [next3[2].key]: "absent",
  });
  assert.equal(simulated.hasChanges, true);
  assert.equal(simulated.attended, 26);
  assert.equal(simulated.total, 35);
  assert.ok(simulated.diff < 0);
});
