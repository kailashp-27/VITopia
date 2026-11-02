import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import overview from "../api/overview.js";
import { sealSession, unsealSession } from "../lib/session.js";
import { VtopClient } from "../lib/vtop.js";
process.env.SESSION_SECRET = randomBytes(32).toString("base64");
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}
test("overview rejects expired, unauthenticated and invalid-semester requests before upstream access", async () => {
  for (const [body, code] of [
    [{ token: "invalid", semesterId: "SEM2026" }, "SESSION_EXPIRED"],
    [
      {
        token: sealSession({ cookies: { cookies: [] } }),
        semesterId: "SEM2026",
      },
      "SESSION_EXPIRED",
    ],
    [
      {
        token: sealSession({ authorizedID: "test", cookies: { cookies: [] } }),
        semesterId: "../wrong",
      },
      "INVALID_SEMESTER",
    ],
  ]) {
    const res = response();
    await overview(
      {
        method: "POST",
        headers: { host: "localhost", "content-type": "application/json" },
        body,
        socket: { remoteAddress: "127.0.0.1" },
      },
      res,
    );
    assert.equal(res.body.code, code);
    assert.equal(res.headers["Cache-Control"], "no-store, private");
  }
});
test("overview is same-origin POST only", async () => {
  const res = response();
  await overview({ method: "GET", headers: { host: "localhost" } }, res);
  assert.equal(res.statusCode, 405);
  const cross = response();
  await overview(
    {
      method: "POST",
      headers: { host: "localhost", origin: "https://untrusted.example" },
    },
    cross,
  );
  assert.equal(cross.statusCode, 403);
});
test("overview checks account semester membership before reading academic pages", async (t) => {
  t.mock.method(VtopClient.prototype, "semesters", async () => [
    { id: "OTHERSEM", name: "Other" },
  ]);
  const read = t.mock.method(
    VtopClient.prototype,
    "authenticated",
    async () => {
      throw new Error("Unexpected upstream read");
    },
  );
  const res = response();
  await overview(
    {
      method: "POST",
      headers: { host: "localhost", "content-type": "application/json" },
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        token: sealSession({
          authorizedID: "fixture-account",
          cookies: { cookies: [] },
        }),
        semesterId: "SEM2026",
      },
    },
    res,
  );
  assert.equal(res.body.code, "INVALID_SEMESTER");
  assert.equal(read.mock.callCount(), 0);
});
test("overview route returns optional data and an updated authenticated session", async (t) => {
  t.mock.method(VtopClient.prototype, "semesters", async () => [
    { id: "SEM2026", name: "Fall" },
  ]);
  t.mock.method(
    VtopClient.prototype,
    "request",
    async () => "<p>No feedback menu</p>",
  );
  t.mock.method(VtopClient.prototype, "authenticated", async (path) =>
    path === "processViewTimeTable"
      ? `<table><tr><th>THEORY</th><th>Start</th><th>08:00</th></tr><tr><th>End</th><th>08:50</th></tr><tr><td>MON</td><td>THEORY</td><td>A1-BCSE302L-TH-AB3-205-ALL</td></tr></table>`
      : "<p>No attendance details</p>",
  );
  const res = response();
  await overview(
    {
      method: "POST",
      headers: { host: "localhost", "content-type": "application/json" },
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        token: sealSession({
          authorizedID: "fixture-account",
          csrf: "fixture-csrf",
          cookies: { cookies: [] },
        }),
        semesterId: "SEM2026",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.overview.timetable.classes[0].start, "08:00");
  assert.equal(res.body.overview.ods.available, false);
  assert.equal(res.body.overview.feedback.available, false);
  assert.equal(unsealSession(res.body.token).authorizedID, "fixture-account");
  assert.equal(res.body.overview.semesterId, "SEM2026");
});
