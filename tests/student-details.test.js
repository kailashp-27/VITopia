import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRegisteredCourses,
  parseODDetails,
  parseFeedbackStatus,
  parseExamSchedule,
  parseODReferences,
  parseStudentIdentity,
} from "../lib/overview-parsers.js";
import { fetchOverview } from "../lib/overview.js";
test("profile identity reads student name and register number without other personal fields", () => {
  assert.deepEqual(
    parseStudentIdentity(
      "<table><tr><td>Student Name</td><td>Example Student</td></tr><tr><td>Reg. No.</td><td>TEST123</td></tr><tr><td>Phone</td><td>private</td></tr></table>",
    ),
    { name: "Example Student", registration: "TEST123" },
  );
});

test("course catalog reads final C credit value without mistaking lab/theory hours for credits", () => {
  const html = `<div id="studentDetailsList"><table><tr><th>Course</th><th>L T P J C</th><th>Slot - Venue</th><th>Faculty</th></tr><tr><td>BCSE355L - Cloud Architecture Design (Theory Only)</td><td>3 0 0 0 3</td><td>A1+TA1 - AB3-205</td><td>Example Faculty</td></tr><tr><td>BCSE204P - Algorithms Lab (Lab Only)</td><td>0 0 2 0 1</td><td>L1+L2 - AB1-402</td><td>Lab Faculty</td></tr></table></div>`;
  const courses = parseRegisteredCourses(html);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].credits, 3);
  assert.equal(courses[1].credits, 1);
  assert.equal(courses[0].type, "Theory Only");
  assert.equal(courses[0].slot, "A1+TA1");
  assert.equal(courses[0].venue, "AB3-205");
  assert.equal(
    parseRegisteredCourses(html.replace("3 0 0 0 3", "Not published"))[0]
      .credits,
    null,
  );
});
test("OD class hours include two-period labs and can exceed forty without clipping", () => {
  const rows = [
    ...Array.from(
      { length: 21 },
      () => "<tr><td>02:00 PM - 03:40 PM</td><td>On Duty</td></tr>",
    ),
    "<tr><td>08:00 - 08:50</td><td>OD</td></tr>",
  ];
  const result = parseODDetails(
    `<table><tr><th>Day And Timing</th><th>Status</th></tr>${rows.join("")}</table>`,
  );
  assert.equal(result.entries, 22);
  assert.equal(result.hours, 43);
  const missing = parseODDetails(
    "<table><tr><th>Date</th><th>Status</th></tr><tr><td>30-Oct-2026</td><td>On Duty</td></tr></table>",
  );
  assert.equal(missing.hours, null);
});
test("overview requests feedback and exams for the selected semester and totals OD hours", async () => {
  const calls = [];
  const client = {
    authenticated: async (path, form) => {
      calls.push([path, form]);
      if (path === "processViewTimeTable")
        return "<table><tr><th>THEORY</th><th>Start</th><th>08:00</th></tr><tr><th>End</th><th>08:50</th></tr><tr><td>MON</td><td>THEORY</td><td>A1-BCSE355L-TH-AB3-205-ALL</td></tr></table>";
      if (path === "processViewFeedBackStatus")
        return "<table><tr><td>Course FeedBack Status</td><td>Course Feed Back Given for MID Semester :)</td><td>Course Feed Back Given for TEE Semester :)</td></tr></table>";
      if (path === "examinations/doSearchExamScheduleForStudent")
        return "<p>No exam schedule found</p>";
      if (path === "processViewStudentAttendance")
        return `<table><tr><td>BCSE355L</td><td><button onclick="processViewAttendanceDetail('CH+/id==','A1')">View</button></td></tr></table>`;
      if (path === "processViewAttendanceDetail")
        return "<table><tr><th>Day And Timing</th><th>Status</th></tr><tr><td>08:00 - 09:40</td><td>On Duty</td></tr></table>";
      return "";
    },
  };
  const result = await fetchOverview(client, "CURRENTSEM");
  assert.equal(result.feedback.status, "submitted");
  assert.equal(result.exams.available, true);
  assert.equal(result.ods.hours, 2);
  assert.equal(result.ods.limit, 40);
  assert.equal(
    parseODReferences(
      `<button onclick="processViewAttendanceDetail('CH+/id==','A1')">View</button>`,
    )[0].classId,
    "CH+/id==",
  );
  assert.ok(
    calls
      .filter(([p]) =>
        [
          "processViewFeedBackStatus",
          "examinations/doSearchExamScheduleForStudent",
          "processViewAttendanceDetail",
        ].includes(p),
      )
      .every(([, form]) => form.semesterSubId === "CURRENTSEM"),
  );
});
test("feedback parses MID and TEE Given/NOT Given including mixed curriculum/course status", () => {
  const html = `<div id="loadMyFragment"><table><tr><th>FeedBack Type</th><th>Mid Semester</th><th>TEE Semester</th></tr><tr><td>Curriculum FeedBack Status</td><td>Curriculum Feed Back Given for MID Semester :)</td><td>Curriculum Feed Back Given for TEE Semester :)</td></tr><tr><td>Course FeedBack Status</td><td>Course Feed Back Given for MID Semester :)</td><td>Course Feed Back NOT Given for TEE Semester :(</td></tr></table></div>`;
  const result = parseFeedbackStatus(html, "SEM2026", true);
  assert.equal(result.available, true);
  assert.equal(result.status, "pending");
  assert.deepEqual(result.rows, [
    { type: "Curriculum", mid: "given", tee: "given" },
    { type: "Course", mid: "given", tee: "not-given" },
  ]);
  assert.equal(
    parseFeedbackStatus(html.replace("NOT Given", "Given"), "SEM2026", true)
      .status,
    "submitted",
  );
  assert.equal(parseFeedbackStatus(html, "SEM2026").available, false);
  assert.equal(
    parseFeedbackStatus(
      `<input name="semesterSubId" value="OLDSEM">${html}`,
      "SEM2026",
      true,
    ).available,
    false,
  );
});
test("exam schedule retains exam sections, slot, date, timing, venue and seat", () => {
  const html = `<table><tr><th>Slot</th><th>Date</th><th>Exam Time</th><th>Venue</th><th>Location</th><th>Seat No.</th></tr><tr><td colspan="6">CAT - II</td></tr><tr><td>A1</td><td>10-OCT-2026</td><td>09:00 - 10:30</td><td>AB3</td><td>205</td><td>24</td></tr><tr><td colspan="6">FAT</td></tr><tr><td>B1</td><td>20-NOV-2026</td><td>09:00 - 12:00</td><td>AB2</td><td>301</td><td>18</td></tr></table>`;
  const result = parseExamSchedule(html);
  assert.equal(result.available, true);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].examType, "FAT");
  assert.equal(result.items[1].seat, "18");
  assert.equal(result.items[0].time, "09:00 - 10:30");
  assert.throws(() => parseExamSchedule("<p>Please sign in</p>"), {
    code: "EXAMS_UNAVAILABLE",
  });
  assert.deepEqual(parseExamSchedule("<p>No exam schedule found</p>"), {
    available: true,
    items: [],
  });
});
