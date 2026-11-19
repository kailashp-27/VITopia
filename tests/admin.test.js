import test from "node:test";
import assert from "node:assert/strict";
import { createAdminHandler, ADMIN_PIN } from "../api/admin.js";

const response = () => ({
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  end(body) {
    this.body = body ? JSON.parse(body) : null;
  },
});

const req = (body, method = "POST") => ({
  method,
  headers: { host: "localhost", "content-type": "application/json" },
  socket: { remoteAddress: "127.0.0.1" },
  body,
});

test("admin API rejects non-POST and invalid pins", async () => {
  const store = new Map();
  const handler = createAdminHandler(store);

  // Method not allowed
  const getRes = response();
  await handler(req({}, "GET"), getRes);
  assert.equal(getRes.statusCode, 405);

  // Invalid PIN
  const unauthRes = response();
  await handler(req({ action: "list", pin: "wrong-pin" }), unauthRes);
  assert.equal(unauthRes.statusCode, 403);
});

test("admin API records pings and returns active user roster on valid PIN", async () => {
  const store = new Map();
  const handler = createAdminHandler(store);

  // Ping 1: Aditya Sharma
  const pingRes1 = response();
  await handler(req({ action: "ping", name: "Aditya Sharma" }), pingRes1);
  assert.equal(pingRes1.statusCode, 200);
  assert.equal(pingRes1.body.ok, true);

  // Ping 2: Kailash N
  const pingRes2 = response();
  await handler(req({ action: "ping", name: "Kailash N" }), pingRes2);
  assert.equal(pingRes2.statusCode, 200);

  // List with valid PIN
  const listRes = response();
  await handler(req({ action: "list", pin: ADMIN_PIN }), listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.success, true);
  assert.equal(listRes.body.total, 2);
  assert.equal(listRes.body.activeToday, 2);

  const names = listRes.body.users.map((u) => u.name);
  assert.ok(names.includes("Aditya Sharma"));
  assert.ok(names.includes("Kailash N"));

  // Check that records have lastActive and no extra credentials
  for (const user of listRes.body.users) {
    assert.ok(user.name);
    assert.ok(user.lastActive);
    assert.equal(user.password, undefined);
    assert.equal(user.credentials, undefined);
  }

  // Clear with valid PIN
  const clearRes = response();
  await handler(req({ action: "clear", pin: ADMIN_PIN }), clearRes);
  assert.equal(clearRes.statusCode, 200);
  assert.equal(clearRes.body.count, 0);
});
