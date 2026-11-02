import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTimetable,
  parseODReferences,
  parseODDetails,
  parseFeedbackStatus,
  feedbackPagePath,
  clockMinutes,
} from "../lib/overview-parsers.js";
import { fetchOverview } from "../lib/overview.js";
import { projectAttendance } from "../src/calc.js";
import { scheduleForDate, weekDates, classTiming } from "../src/schedule.js";
import { academicDayStatus, reminderCountdown } from "../src/calendar-utils.js";
import { parseCalendarDays } from "../lib/calendar.js";

const timetableHTML = `<div id="studentDetailsList"><table><thead><tr><th>Course</th><th>Faculty</th></tr></thead><tbody><tr><td>BCSE302L - Database Systems (Theory)</td><td>Example Faculty</td></tr><tr><td>BCSE302P - Database Lab (Lab)</td><td>Lab Faculty</td></tr></tbody></table></div>
<table><tr><th rowspan="2">THEORY</th><th>Start</th><th>08:00</th><th>09:00</th><th>Lunch</th><th>14:00</th></tr><tr><th>End</th><th>08:50</th><th>09:50</th><th>Lunch</th><th>14:50</th></tr>
<tr><th rowspan="2">LAB</th><th>Start</th><th>08:00</th><th>08:50</th><th>Lunch</th><th>14:00</th></tr><tr><th>End</th><th>08:50</th><th>09:40</th><th>Lunch</th><th>14:50</th></tr>
<tr><td rowspan="2">MON</td><td>THEORY</td><td>A1-BCSE302L-TH-AB3-205-ALL</td><td>F1</td><td>Lunch</td><td>D2-BCSE302L-TH-AB3-205-ALL</td></tr><tr><td>LAB</td><td>L1-BCSE302P-LO-AB1-402-ALL</td><td>L2-BCSE302P-LO-AB1-402-ALL</td><td>Lunch</td><td>-</td></tr></table>`;
const refsHTML = `<table><tr><th>Course Code</th><th>Details</th></tr><tr><td>BCSE302L</td><td><button onclick="processViewAttendanceDetail('CLASS1','A1')">View</button></td></tr><tr><td>BCSE302P</td><td><button onclick="processViewAttendanceDetail('CLASS2','L1+L2')">View</button></td></tr></table>`;
const detailHTML = (statuses) =>
  `<table><thead><tr><th>Date</th><th>Day And Timing</th><th>Attendance Status</th></tr></thead><tbody>${statuses.map((s) => `<tr><td>29-Oct-2026</td><td>08:00 - 08:50</td><td>${s}</td></tr>`).join("")}</tbody></table>`;
const feedbackHTML = (sem = "SEM2026") =>
  `<select name="semesterSubId"><option value="${sem}" selected>Fall</option></select><table><tr><th>Course</th><th>Status</th></tr><tr><td>BCSE302L</td><td>Submitted</td></tr><tr><td>BCSE302P</td><td>Not Submitted</td></tr></table>`;

test("independent attendance and absence sliders combine without mutating the course", () => {
  const course = { attended: 24, total: 28 };
  const result = projectAttendance(course.attended, course.total, 5, 2);
  assert.equal(result.attended, 29);
  assert.equal(result.total, 35);
  assert.equal(result.percent, (29 / 35) * 100);
  assert.deepEqual(course, { attended: 24, total: 28 });
  for (let attend = 0; attend <= 10; attend++)
    for (let miss = 0; miss <= 10; miss++) {
      const p = projectAttendance(24, 28, attend, miss);
      assert.equal(p.percent, ((24 + attend) / (28 + attend + miss)) * 100);
    }
  assert.throws(() => projectAttendance(24, 28, 11, 0));
  assert.throws(() => projectAttendance(24, 28, 0, -1));
  assert.equal(projectAttendance(0, 0).percent, null);
});
test("timetable aligns rowspan headers, afternoon columns, venues and merged lab blocks", () => {
  const { classes } = parseTimetable(timetableHTML);
  assert.equal(classes.length, 3);
  assert.deepEqual(
    classes.map((s) => [s.day, s.code, s.start, s.end, s.venue]),
    [
      ["MON", "BCSE302L", "08:00", "08:50", "AB3-205"],
      ["MON", "BCSE302P", "08:00", "09:40", "AB1-402"],
      ["MON", "BCSE302L", "14:00", "14:50", "AB3-205"],
    ],
  );
  assert.equal(classes[0].title, "Database Systems");
  assert.equal(classes[1].slot, "L1+L2");
  assert.equal(clockMinutes("01:40 PM"), 820);
  assert.equal(clockMinutes("12:00 AM"), 0);
  assert.equal(clockMinutes("25:30"), null);
  assert.throws(() => parseTimetable("<p>Login</p>"), {
    code: "TIMETABLE_UNAVAILABLE",
  });
  assert.throws(
    () =>
      parseTimetable(
        timetableHTML.replaceAll("08:00", "??").replaceAll("14:00", "??"),
      ),
    { code: "TIMETABLE_UNAVAILABLE" },
  );
});
test("calendar holidays override generic flags and survive plain text markup", () => {
  const html = `<table class="calendar-table"><tr><td><span>6</span><span>Instructional Day</span><div>Diwali Holidays</div></td><td><span>7</span><span>Instructional Day</span><div>MONDAY Day Order</div></td><td><span>8</span><div>Campus exhibition</div></td></tr></table>`;
  const days = parseCalendarDays(html, "01-NOV-2026");
  assert.equal(days[0].instructional, false);
  assert.equal(days[0].label, "Diwali Holidays");
  assert.equal(days[0].conflict, true);
  assert.equal(days[1].dayOrder, "Monday");
  assert.equal(days[2].instructional, null);
  assert.equal(
    academicDayStatus({ instructional: true, label: "Diwali holidays" }),
    "holiday",
  );
  assert.equal(academicDayStatus(null), "unknown");
});
test("explicit same-month holiday ranges override generic working flags without fixed dates", () => {
  const html =
    '<table class="calendar-table"><tr><td><span>4</span><span>No Instructional Day</span><div>Diwali Holidays: 4 to 11 November 2026</div></td><td><span>6</span><span>Instructional Day</span></td><td><span>12</span><span>Instructional Day</span></td></tr></table>';
  const days = parseCalendarDays(html, "01-NOV-2026");
  assert.equal(
    days.find((day) => day.date === "2026-11-06").instructional,
    false,
  );
  assert.equal(days.find((day) => day.date === "2026-11-06").conflict, true);
  assert.equal(
    days.find((day) => day.date === "2026-11-12").instructional,
    true,
  );
});
test("daily schedule follows working Saturday overrides and suppresses holiday classes", () => {
  const timetable = parseTimetable(timetableHTML);
  const calendar = {
    days: [
      {
        date: "2026-11-07",
        instructional: true,
        label: "Monday Day Order",
        dayOrder: "Monday",
      },
      { date: "2026-11-09", instructional: true, label: "Diwali Holidays" },
    ],
  };
  assert.equal(
    scheduleForDate(timetable, calendar, "2026-11-07").classes.length,
    3,
  );
  assert.equal(
    scheduleForDate(timetable, calendar, "2026-11-09").holiday,
    true,
  );
  assert.equal(
    scheduleForDate(timetable, calendar, "2026-11-09").classes.length,
    0,
  );
  assert.equal(scheduleForDate(null, null, "2026-11-09").available, false);
  assert.equal(weekDates("2027-01-01")[0].date, "2026-12-28");
  assert.equal(classTiming({ start: "08:00", end: "08:50" }, 480), "current");
  assert.equal(classTiming({ start: "08:00", end: "08:50" }, 530), "finished");
});
test("reminder countdowns use calendar dates across month and year boundaries", () => {
  assert.equal(reminderCountdown("2027-01-01", "2026-12-31"), "Tomorrow");
  assert.equal(reminderCountdown("2026-11-06", "2026-11-01"), "In 5 days");
  assert.equal(reminderCountdown("2026-11-06", "2026-11-06"), "Today");
  assert.equal(reminderCountdown("2026-11-05", "2026-11-06"), "Yesterday");
});
test("ODs count credited entries and distinguish a verified zero from unavailable data", () => {
  const refs = parseODReferences(refsHTML);
  assert.deepEqual(
    refs.map((r) => r.slot),
    ["A1", "L1+L2"],
  );
  assert.deepEqual(
    parseODDetails(detailHTML(["Present", "On Duty", "Absent", "OD"])),
    { entries: 2, recorded: 4, hours: 2 },
  );
  assert.equal(parseODDetails(detailHTML(["Present", "Absent"])).entries, 0);
  assert.throws(() => parseODDetails("<p>Session expired</p>"), {
    code: "OD_UNAVAILABLE",
  });
  assert.throws(() => parseODDetails(detailHTML([])), {
    code: "OD_UNAVAILABLE",
  });
  assert.throws(
    () => parseODDetails(detailHTML(["Present", "Unknown status"])),
    { code: "OD_UNAVAILABLE" },
  );
});
test("feedback reads explicit semester-scoped status and never treats empty pages as submitted", () => {
  assert.deepEqual(parseFeedbackStatus(feedbackHTML(), "SEM2026"), {
    available: true,
    status: "pending",
    submitted: 1,
    total: 2,
  });
  assert.equal(
    parseFeedbackStatus(feedbackHTML("OLDSEM"), "SEM2026").available,
    false,
  );
  assert.equal(
    parseFeedbackStatus("<p>Welcome</p>", "SEM2026").available,
    false,
  );
  assert.equal(
    parseFeedbackStatus("<p>Feedback is not open</p>", "SEM2026").status,
    "not-open",
  );
  assert.equal(
    feedbackPagePath(
      '<a data-url="feedback/CourseFeedback">Course feedback</a>',
    ),
    "feedback/CourseFeedback",
  );
  assert.equal(
    feedbackPagePath(
      '<a href="https://other.example/feedback">Course feedback</a>',
    ),
    null,
  );
  assert.equal(
    feedbackPagePath(
      '<a href="feedback/saveCourseFeedback">Course feedback</a>',
    ),
    null,
  );
});
test("overview fetches read-only details with bounded OD concurrency and partial failure isolation", async () => {
  let active = 0,
    peak = 0;
  const calls = [];
  const client = {
    request: async () =>
      '<a data-url="feedback/CourseFeedback">Course feedback</a>',
    authenticated: async (path, payload) => {
      calls.push([path, payload]);
      if (path === "processViewTimeTable") return timetableHTML;
      if (path === "processViewStudentAttendance") return refsHTML;
      if (path === "processViewAttendanceDetail") {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setImmediate(resolve));
        active--;
        return detailHTML(["Present", "On Duty"]);
      }
      if (path === "processViewFeedBackStatus") return feedbackHTML();
      return "";
    },
  };
  const result = await fetchOverview(client, "SEM2026");
  assert.equal(result.ods.entries, 2);
  assert.equal(peak, 2);
  assert.equal(result.timetable.classes.length, 3);
  assert.equal(result.feedback.status, "pending");
  assert.ok(
    calls
      .filter(([path]) => path === "processViewAttendanceDetail")
      .every(([, form]) => form.semesterSubId === "SEM2026"),
  );
  client.authenticated = async (path) =>
    path === "processViewTimeTable" ? timetableHTML : "<p>Unavailable</p>";
  const partial = await fetchOverview(client, "SEM2026");
  assert.equal(partial.timetable.available, true);
  assert.equal(partial.ods.available, false);
  assert.equal(partial.feedback.available, false);
});
