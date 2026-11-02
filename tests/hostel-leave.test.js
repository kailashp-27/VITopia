import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { parseHostelLeave } from "../lib/hostel-leave.js";
import { createLeaveHandler } from "../api/hostel-leave.js";
import { VtopClient } from "../lib/vtop.js";
import { sealSession, unsealSession } from "../lib/session.js";
process.env.SESSION_SECRET = randomBytes(32).toString("base64");
const fixture = (kind, status = "APPROVED") =>
  `<table id="${kind === "status" ? "LeaveAppliedTable" : "LeaveHistoryTable"}"><tr><th>Leave ID</th><th>Leave Type</th><th>From Date</th><th>To Date</th><th>Status</th><th>Remarks</th></tr><tr><td>LV123</td><td>Home Leave</td><td>04-Nov-2026 16:00</td><td>11-Nov-2026 20:00</td><td>${status}</td><td>Example remark</td></tr></table>`;
const response = () => ({
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(body) {
    this.body = JSON.parse(body);
  },
});
const req = (body) => ({
  method: "POST",
  headers: { host: "localhost", "content-type": "application/json" },
  socket: { remoteAddress: "leave-test" },
  body,
});
test("leave tables parse reordered headers and preserve VTOP status text", () => {
  const parsed = parseHostelLeave(
    fixture("status", "PROCTOR APPROVAL PENDING"),
    "status",
  );
  assert.equal(parsed.items[0].id, "LV123");
  assert.equal(parsed.items[0].status, "PROCTOR APPROVAL PENDING");
  assert.equal(parsed.items[0].from, "04-Nov-2026 16:00");
  assert.equal(parsed.items[0].remarks, "Example remark");
});
test("documented Chennai status/history offsets are distinct and empty differs from unavailable", () => {
  const row = (values) =>
    `<tr>${values.map((v) => `<td>${v}</td>`).join("")}</tr>`;
  const values = [
    "LV10",
    "Chennai",
    "Home",
    "Home Leave",
    "04-Nov-2026",
    "11-Nov-2026",
    "APPROVED",
    "-",
  ];
  for (const kind of ["status", "history"]) {
    const cells =
      kind === "status" ? ["select", "1", ...values] : ["1", ...values];
    const html = `<table id="${kind === "status" ? "LeaveAppliedTable" : "LeaveHistoryTable"}">${row(cells)}</table>`;
    assert.equal(parseHostelLeave(html, kind).items[0].id, "LV10");
  }
  assert.deepEqual(
    parseHostelLeave(
      '<table id="LeaveHistoryTable"><tr><td colspan="9">No records found</td></tr></table>',
      "history",
    ).items,
    [],
  );
  assert.throws(
    () => parseHostelLeave("<h1>Unexpected portal response</h1>", "status"),
    { code: "LEAVE_FORMAT_CHANGED" },
  );
  assert.throws(
    () => parseHostelLeave("<p>Only for hostellers</p>", "status"),
    { code: "HOSTEL_LEAVE_UNAVAILABLE" },
  );
  assert.throws(
    () =>
      parseHostelLeave(
        '<table id="LeaveAppliedTable"><tr><th>Leave ID</th><th>Status</th></tr><tr><td>LV1</td><td>Pending</td></tr></table>',
        "status",
      ),
    { code: "LEAVE_FORMAT_CHANGED" },
  );
});
test("leave API rejects cross-origin, wrong method and expired/unauthenticated sessions before upstream", async () => {
  assert.throws(
    () =>
      parseHostelLeave("<h1>Dashboard</h1><p>No records found</p>", "status"),
    { code: "LEAVE_FORMAT_CHANGED" },
  );
  let reads = 0;
  const handler = createLeaveHandler(() => {
    reads++;
    throw Error("Unexpected request");
  });
  for (const request of [
    { method: "GET", headers: {} },
    {
      method: "POST",
      headers: { host: "localhost", origin: "https://outside.example" },
    },
    req({ token: "invalid" }),
    req({ token: sealSession({}) }),
  ]) {
    const res = response();
    await handler(request, res);
    assert.ok(res.statusCode >= 400);
    assert.equal(res.headers["Cache-Control"], "no-store, private");
  }
  assert.equal(reads, 0);
});
test("API reads status and history via real HTTP, retains partial results, and renews sealed session", async () => {
  const calls = [];
  let historyFails = false,
    expired = false;
  const upstream = createServer(async (request, res) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const form = new URLSearchParams(body);
    calls.push({
      path: request.url,
      control: form.get("control"),
      auth: form.get("authorizedID"),
      csrf: form.get("_csrf"),
    });
    res.setHeader("Content-Type", "text/html");
    if (expired) {
      res.end('<form id="vtopLoginForm"></form>');
      return;
    }
    if (request.url.endsWith("/1")) {
      res.end('<input name="_csrf" value="fresh-csrf">');
      return;
    }
    if (request.url.endsWith("/6") && historyFails) {
      res.statusCode = 503;
      res.end("Unavailable");
      return;
    }
    res.end(fixture(request.url.endsWith("/4") ? "status" : "history"));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${upstream.address().port}`;
  const handler = createLeaveHandler(
    (session) =>
      new VtopClient(session, (url, options) =>
        fetch(new URL(url.pathname, base), options),
      ),
  );
  const token = sealSession({ authorizedID: "fixture-user", csrf: "old-csrf" });
  try {
    let res = response();
    await handler(req({ token }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leave.status.items[0].id, "LV123");
    assert.equal(res.body.leave.history.items[0].id, "LV123");
    assert.equal(unsealSession(res.body.token).csrf, "fresh-csrf");
    assert.deepEqual(
      calls.map((c) => c.path),
      [
        "/vtop/hostels/student/leave/1",
        "/vtop/hostels/student/leave/4",
        "/vtop/hostels/student/leave/6",
      ],
    );
    assert.deepEqual(
      calls.map((c) => c.control),
      [null, "status", "history"],
    );
    assert.ok(calls.every((c) => c.auth === "fixture-user"));
    assert.equal(calls[1].csrf, "fresh-csrf");
    historyFails = true;
    res = response();
    await handler(req({ token }), res);
    assert.equal(res.body.leave.status.available, true);
    assert.equal(res.body.leave.history.available, false);
    expired = true;
    res = response();
    await handler(req({ token }), res);
    assert.equal(res.body.code, "SESSION_EXPIRED");
  } finally {
    await new Promise((resolve) => upstream.close(resolve));
  }
});
