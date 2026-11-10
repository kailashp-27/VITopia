import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRegisteredCourses,
  parseODDetails,
  parseFeedbackStatus,
  parseExamSchedule,
  parseODReferences,
  parseStudentIdentity,
  parseCGPA,
  parseCreditsAndCGPA,
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

test("profile identity reads full student details including email, dob, gender, branch, year joined, campus, and cgpa", () => {
  const html = `
    <table>
      <tr><td>Student Name</td><td>Aditya Sharma</td><td>Register Number</td><td>23BCE1042</td></tr>
      <tr><td>Email ID</td><td>aditya.sharma2023@vitstudent.ac.in</td><td>Date of Birth</td><td>14-Aug-2005</td></tr>
      <tr><td>Gender</td><td>Male</td><td>Programme & Branch</td><td>B.Tech Computer Science and Engineering</td></tr>
      <tr><td>Year of Admission</td><td>2023</td><td>Campus</td><td>Chennai</td></tr>
      <tr><td>CGPA</td><td>9.18</td></tr>
    </table>
  `;
  const profile = parseStudentIdentity(html);
  assert.equal(profile.name, "Aditya Sharma");
  assert.equal(profile.registration, "23BCE1042");
  assert.equal(profile.email, "aditya.sharma2023@vitstudent.ac.in");
  assert.equal(profile.dob, "14-Aug-2005");
  assert.equal(profile.gender, "Male");
  assert.equal(profile.branch, "B.Tech Computer Science and Engineering");
  assert.equal(profile.yearJoined, "2023");
  assert.equal(profile.campus, "Chennai");
  assert.equal(profile.cgpa, "9.18");
});

test("profile identity parses tables with colon separator cells without mistaking colons for values", () => {
  const html = `
    <table>
      <tr><td>Student Name</td><td>:</td><td>KAILASH P</td><td>Reg No</td><td>:</td><td>24BCE1001</td></tr>
      <tr><td>Date of Birth</td><td>:</td><td>15-MAY-2005</td><td>Gender</td><td>:</td><td>MALE</td></tr>
      <tr><td>Programme & Branch</td><td>:</td><td>B.TECH - CSE</td><td>Campus</td><td>:</td><td>CHENNAI</td></tr>
    </table>
  `;
  const profile = parseStudentIdentity(html);
  assert.equal(profile.name, "KAILASH P");
  assert.equal(profile.registration, "24BCE1001");
  assert.equal(profile.dob, "15-MAY-2005");
  assert.equal(profile.gender, "MALE");
  assert.equal(profile.branch, "B.TECH - CSE");
  assert.equal(profile.campus, "CHENNAI");
});

test("profile identity extracts full student, proctor, and hostel details from VTOP StudentProfileAllView without hardcoding", () => {
  const vtopDomHtml = `
    <input type="hidden" name="authorizedIDX" id="authorizedIDX" value="24BRS1382">
    <div class="box box-solid box-primary">
      <div class="box-body">
        <div class="col-4 text-center">
          <img id="img_stud_photo" src="data:null;base64,studentphotodata" />
          <p style="text-align: center; font-weight: bold">KAILASH P</p>
        </div>
        <div class="col-8">
          <label for="regno"> REGISTER NUMBER:</label>
          <label for="no">24BRS1382</label>
          <label for="vitmail"> VIT EMAIL: </label>
          <label for="vmail">kailash.p2024@vitstudent.ac.in</label>
          <label for="branch"> PROGRAM &amp; BRANCH:</label>
          <label for="branchno">B.Tech - Computer Science and Engineering(Artificial Intelligence and Machine Learning)</label>
          <label for="schoolname"> SCHOOL NAME: </label>
          <label for="schoolno">School of Computer Science and Engineering</label>
        </div>
      </div>
    </div>
    <div id="collapseOne" class="panel-collapse collapse in">
      <table class="table">
        <tr>
          <td><label class="control-label">APPLICATION NUMBER</label></td>
          <td>2024107567</td>
        </tr>
        <tr>
          <td><label class="control-label">Date of Birth</label></td>
          <td>02-09-2006</td>
          <td><label class="control-label">Gender</label></td>
          <td>Male</td>
        </tr>
        <tr>
          <td><label class="control-label">Blood Group</label></td>
          <td>B+</td>
          <td><label class="control-label">Mobile Number</label></td>
          <td>9876543210</td>
        </tr>
        <tr>
          <td><label class="control-label">Email</label></td>
          <td>kailash.personal@example.com</td>
        </tr>
      </table>
    </div>
    <div id="collapseFour" class="panel-collapse collapse">
      <table class="table">
        <tr>
          <td rowspan="8" class="text-center">
            <img class="img-circle" src="data:null;base64,proctorphotodata" />
          </td>
        </tr>
        <tr>
          <td><label class="control-label">Faculty ID</label></td>
          <td>53609</td>
        </tr>
        <tr>
          <td><label class="control-label">Faculty Name</label></td>
          <td>SIVARAMAKRISHNAN N</td>
        </tr>
        <tr>
          <td><label class="control-label">Designation</label></td>
          <td>Associate Professor Grade 1</td>
        </tr>
        <tr>
          <td><label class="control-label">School</label></td>
          <td>SCOPE</td>
        </tr>
        <tr>
          <td><label class="control-label">Cabin</label></td>
          <td>AB3-324/5</td>
        </tr>
        <tr>
          <td><label class="control-label">Department</label></td>
          <td>Department of Analytics</td>
        </tr>
        <tr>
          <td><label class="control-label">Email</label></td>
          <td>sivaramakrishnan.n@vit.ac.in</td>
        </tr>
        <tr>
          <td><label class="control-label">Mobile Number</label></td>
          <td>9884501255</td>
        </tr>
      </table>
    </div>
    <div id="collapseFive" class="panel-collapse collapse">
      <table class="table">
        <tr>
          <td><label class="control-label">Block</label></td>
          <td>D1</td>
          <td><label class="control-label">Room No</label></td>
          <td>312</td>
        </tr>
        <tr>
          <td><label class="control-label">Bed Type</label></td>
          <td>2 Bed AC</td>
          <td><label class="control-label">Mess</label></td>
          <td>Special Mess</td>
        </tr>
      </table>
    </div>
  `;
  const profile = parseStudentIdentity(vtopDomHtml);

  // Student header & basic details
  assert.equal(profile.name, "KAILASH P");
  assert.equal(profile.registration, "24BRS1382");
  assert.equal(profile.applicationNumber, "2024107567");
  assert.equal(profile.email, "kailash.p2024@vitstudent.ac.in");
  assert.equal(profile.branch, "B.Tech - Computer Science and Engineering(Artificial Intelligence and Machine Learning)");
  assert.equal(profile.school, "School of Computer Science and Engineering");
  assert.equal(profile.photo, "data:image/jpeg;base64,studentphotodata");

  // Personal details
  assert.equal(profile.dob, "02-09-2006");
  assert.equal(profile.gender, "Male");
  assert.equal(profile.bloodGroup, "B+");
  assert.equal(profile.mobile, "9876543210");
  assert.equal(profile.personalEmail, "kailash.personal@example.com");

  // Proctor details
  assert.ok(profile.proctor, "proctor details should exist");
  assert.equal(profile.proctor.id, "53609");
  assert.equal(profile.proctor.name, "SIVARAMAKRISHNAN N");
  assert.equal(profile.proctor.designation, "Associate Professor Grade 1");
  assert.equal(profile.proctor.school, "SCOPE");
  assert.equal(profile.proctor.cabin, "AB3-324/5");
  assert.equal(profile.proctor.department, "Department of Analytics");
  assert.equal(profile.proctor.email, "sivaramakrishnan.n@vit.ac.in");
  assert.equal(profile.proctor.mobile, "9884501255");
  assert.equal(profile.proctor.photo, "data:image/jpeg;base64,proctorphotodata");

  // Hostel details
  assert.ok(profile.hostel, "hostel details should exist");
  assert.equal(profile.hostel.block, "D1");
  assert.equal(profile.hostel.roomNo, "312");
  assert.equal(profile.hostel.bedType, "2 Bed AC");
  assert.equal(profile.hostel.mess, "Special Mess");
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

test("parseCGPA extracts CGPA correctly from tables, inputs, labels, and text", () => {
  // Table format with colon
  assert.equal(
    parseCGPA("<table><tr><td>CGPA</td><td>:</td><td>9.14</td></tr></table>"),
    "9.14",
  );

  // Cumulative Grade Point Average table row
  assert.equal(
    parseCGPA(
      "<table><tr><th>Cumulative Grade Point Average</th><td>8.75</td></tr></table>",
    ),
    "8.75",
  );

  // Input value with id/name/class
  assert.equal(
    parseCGPA('<input type="text" id="cgpa" value="8.92" readonly />'),
    "8.92",
  );

  // Text container with CGPA label
  assert.equal(
    parseCGPA(
      '<div class="grade-summary"><span>Current CGPA: 9.38</span></div>',
    ),
    "9.38",
  );

  // Column header table format (<thead><th>CGPA</th> and <tbody><td>8.85</td>)
  assert.equal(
    parseCGPA(
      '<table id="cgpaTable"><thead><tr><th>Registered</th><th>Earned</th><th>GPA</th><th>CGPA</th></tr></thead><tbody><tr><td>24</td><td>24</td><td>9.12</td><td>8.85</td></tr></tbody></table>',
    ),
    "8.85",
  );

  // Parenthesized label format
  assert.equal(
    parseCGPA(
      '<div><span>Cumulative Grade Point Average (CGPA) : </span><span>8.65</span></div>',
    ),
    "8.65",
  );

  // Nested paragraph format
  assert.equal(
    parseCGPA('<div class="row"><p><b>CGPA:</b> <span>8.95</span></p></div>'),
    "8.95",
  );
});

test("parseCGPA rejects out-of-range values, invalid numbers, and handles empty inputs", () => {
  assert.equal(parseCGPA(""), null);
  assert.equal(parseCGPA(null), null);
  assert.equal(parseCGPA(undefined), null);

  // Number > 10 is rejected
  assert.equal(
    parseCGPA("<table><tr><td>CGPA</td><td>12.50</td></tr></table>"),
    null,
  );

  // Dash / pending indicator
  assert.equal(
    parseCGPA("<table><tr><td>CGPA</td><td>:</td><td>-</td></tr></table>"),
    null,
  );

  // N/A or text
  assert.equal(
    parseCGPA("<table><tr><td>CGPA</td><td>N/A</td></tr></table>"),
    null,
  );

  // Non-matching text
  assert.equal(
    parseCGPA("<div><p>No grade information available</p></div>"),
    null,
  );
});

test("overview fetches CGPA from grade history or curriculum when not in StudentProfileAllView", async () => {
  const requestedPaths = [];
  const client = {
    authenticated: async (path, form) => {
      requestedPaths.push(path);
      if (path === "StudentProfileAllView") {
        return `
          <div class="box-body">
            <label for="no">24BRS1382</label>
            <label for="vmail">kailash.p2024@vitstudent.ac.in</label>
            <p style="text-align: center; font-weight: bold">KAILASH P</p>
          </div>
        `;
      }
      if (path === "examinations/examGradeView/StudentGradeHistory") {
        return `
          <div class="grade-report">
            <table>
              <tr><td>CGPA</td><td>:</td><td>9.25</td></tr>
            </table>
          </div>
        `;
      }
      return "";
    },
  };

  const result = await fetchOverview(client, "CURRENTSEM");
  assert.ok(
    requestedPaths.includes("examinations/examGradeView/StudentGradeHistory"),
  );
  assert.equal(result.profile?.cgpa, "9.25");
  assert.equal(result.cgpa, "9.25");
});

test("parseCreditsAndCGPA extracts CGPA, credits earned, and credits required from VTOP dashboard markup", () => {
  const dashHtml = `
    <ul class="list-group">
      <li class="list-group-item d-flex justify-content-between align-items-start p-0 m-0">
        <span class=" card-title fontcolor1 p-0 m-0">Credits Required :</span>
        <span class="fontcolor3 w-25 py-1 m-0 text-center bg-primary bg-opacity-10"><span>151</span></span>
      </li>
      <li class="list-group-item d-flex justify-content-between align-items-start p-0 m-0">
        <span class=" card-title fontcolor1 p-0 m-0">Earned Credits :</span>
        <span class="fontcolor3 w-25 py-1 m-0 text-center bg-primary bg-opacity-25"><span>89.0</span></span>
      </li>
      <li class="list-group-item d-flex justify-content-between align-items-start p-0 m-0">
        <span class=" card-title fontcolor1 p-0 m-0">Current CGPA :</span>
        <span class="fontcolor3 w-25 py-1 m-0 text-center bg-primary bg-opacity-50"><span>8.94</span></span>
      </li>
    </ul>
  `;
  const result = parseCreditsAndCGPA(dashHtml);
  assert.equal(result.cgpa, "8.94");
  assert.equal(result.creditsEarned, "89.0");
  assert.equal(result.creditsRequired, "151");
});

test("parseCreditsAndCGPA returns nulls when inputs are empty or without credit information", () => {
  assert.deepEqual(parseCreditsAndCGPA(""), {
    cgpa: null,
    creditsEarned: null,
    creditsRequired: null,
  });
  assert.deepEqual(parseCreditsAndCGPA(null), {
    cgpa: null,
    creditsEarned: null,
    creditsRequired: null,
  });
  assert.deepEqual(
    parseCreditsAndCGPA("<div><p>No academic statistics</p></div>"),
    {
      cgpa: null,
      creditsEarned: null,
      creditsRequired: null,
    },
  );
});

test("overview fetches CGPA and earned credits from dashboard endpoint get/dashboard/current/cgpa/credits", async () => {
  const requestedPaths = [];
  const client = {
    authenticated: async (path, form) => {
      requestedPaths.push(path);
      if (path === "get/dashboard/current/cgpa/credits") {
        return `
          <ul class="list-group">
            <li class="list-group-item">
              <span>Earned Credits :</span>
              <span>89.0</span>
            </li>
            <li class="list-group-item">
              <span>Current CGPA :</span>
              <span>8.94</span>
            </li>
          </ul>
        `;
      }
      if (path === "studentsRecord/StudentProfileAllView") {
        return `
          <div class="box-body">
            <label for="no">24BRS1382</label>
            <label for="vmail">kailash.p2024@vitstudent.ac.in</label>
            <p style="text-align: center; font-weight: bold">KAILASH P</p>
          </div>
        `;
      }
      return "";
    },
  };

  const result = await fetchOverview(client, "CURRENTSEM");
  assert.ok(requestedPaths.includes("get/dashboard/current/cgpa/credits"));
  assert.equal(result.profile?.cgpa, "8.94");
  assert.equal(result.profile?.creditsEarned, "89.0");
  assert.equal(result.cgpa, "8.94");
  assert.equal(result.creditsEarned, "89.0");
});
