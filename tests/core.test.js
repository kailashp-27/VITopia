import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  attendancePlan,
  overallAttendance,
  weightedMarks,
} from "../src/calc.js";
import { sealSession, unsealSession } from "../lib/session.js";
import { parseAttendance, parseMarks, parseSemesters } from "../lib/parsers.js";
process.env.SESSION_SECRET = randomBytes(32).toString("base64");
test("attendance boundaries and exact 75% threshold", () => {
  assert.equal(attendancePlan(24, 32).skip, 0);
  assert.equal(attendancePlan(24, 28).skip, 4);
  assert.equal(attendancePlan(22, 30).attend, 2);
  assert.equal(attendancePlan(0, 0).percent, null);
  assert.throws(() => attendancePlan(6, 5));
  assert.ok(
    Math.abs(
      overallAttendance([
        { attended: 10, total: 10 },
        { attended: 1, total: 10 },
      ]).percent - 55,
    ) < 1e-9,
  );
});
test("calculator plans remain safe across thousands of count combinations", () => {
  for (let total = 1; total < 90; total++)
    for (let attended = 0; attended <= total; attended++)
      for (const target of [75, 80, 85, 90]) {
        const p = attendancePlan(attended, total, target);
        if (p.attend) {
          assert.ok(
            ((attended + p.attend) / (total + p.attend)) * 100 >= target - 1e-9,
          );
          assert.ok(
            ((attended + p.attend - 1) / (total + p.attend - 1)) * 100 < target,
          );
        } else {
          assert.ok((attended / (total + p.skip)) * 100 >= target - 1e-9);
          assert.ok((attended / (total + p.skip + 1)) * 100 < target);
        }
      }
});
test("session token authenticates, expires, and rejects tampering", () => {
  const token = sealSession(
    { csrf: "secret-csrf", cookies: { cookies: [] } },
    1000,
  );
  assert.equal(unsealSession(token, 2000).csrf, "secret-csrf");
  assert.ok(!token.includes("secret-csrf"));
  assert.throws(() => unsealSession(token, 301000), {
    code: "SESSION_EXPIRED",
  });
  const raw = Buffer.from(token, "base64url");
  raw[35] ^= 1;
  assert.throws(() => unsealSession(raw.toString("base64url"), 2000), {
    code: "SESSION_EXPIRED",
  });
});
test("attendance columns can be reordered, with the percentage recomputed", () => {
  const result = parseAttendance(
    '<table id="getStudentDetails"><tr><th>Total Classes</th><th>Course Title</th><th>Course Code</th><th>Attended Classes</th><th>Course Type</th></tr><tr><td>28</td><td>Data Structures</td><td>BCSE202L</td><td>24</td><td>Theory</td></tr></table>',
  );
  assert.deepEqual(result[0], {
    code: "BCSE202L",
    title: "Data Structures",
    type: "Theory",
    slot: "",
    total: 28,
    attended: 24,
    percent: 85.7,
  });
  assert.throws(() => parseAttendance("<html>Maintenance underway</html>"), {
    code: "PARSE_ERROR",
  });
  assert.deepEqual(parseAttendance("<p>No data found</p>"), []);
});
test("nested marks keep missing scores distinct from a real zero", () => {
  const result = parseMarks(
    '<div id="fixedTableContainer"><table><tr><td>Course Code</td><td>Course Title</td><td>Course Type</td></tr><tr><td>BCSE202L</td><td>Data Structures</td><td>Theory</td></tr><tr><td colspan="3"><table><tr><td>Title</td><td>Max. Marks</td><td>Scored Marks</td><td>Weightage %</td><td>Weightage Marks</td></tr><tr><td>CAT-1</td><td>50</td><td>0</td><td>15</td><td>0</td></tr><tr><td>FAT</td><td>100</td><td>-</td><td>40</td><td>-</td></tr></table></td></tr></table></div>',
  );
  assert.equal(result[0].components[0].scored, 0);
  assert.equal(result[0].components[1].scored, null);
  assert.deepEqual(weightedMarks(result[0].components), {
    scored: 0,
    outOf: 15,
  });
  assert.throws(() => parseMarks("<html>Unexpected response</html>"), {
    code: "PARSE_ERROR",
  });
});
test("semester parser excludes unrelated dropdowns and placeholder values", () => {
  assert.deepEqual(
    parseSemesters(
      '<select id="semesterSubId"><option value="">Choose</option><option value="0">Select</option><option value="CH2026001">Fall 2026</option></select><select><option value="x">Not a semester</option></select>',
    ),
    [{ id: "CH2026001", name: "Fall 2026" }],
  );
});
