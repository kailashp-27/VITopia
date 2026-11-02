import test from "node:test";
import assert from "node:assert/strict";
import { prepareVerification } from "../src/captcha-flow.js";

const current = {
  image: "current-image",
  token: "current-token",
  expiresAt: 500,
};
function setup(overrides = {}) {
  const calls = [];
  return {
    calls,
    options: {
      challenge: null,
      answer: "",
      manual: false,
      now: () => 100,
      load: async () => {
        calls.push("load");
        return current;
      },
      read: async (image) => {
        calls.push(image);
        return { text: "ABC234", reliable: true };
      },
      ...overrides,
    },
  };
}
test("reliable automatic reading uses the matching image and session", async () => {
  const { calls, options } = setup();
  assert.deepEqual(await prepareVerification(options), {
    challenge: current,
    answer: "ABC234",
  });
  assert.deepEqual(calls, ["load", "current-image"]);
});
test("uncertain or failed reading pauses for manual input without a guessed answer", async () => {
  for (const read of [
    async () => ({ text: "ABC234", reliable: false }),
    async () => {
      throw new Error("Reader unavailable");
    },
  ]) {
    const { options } = setup({ read });
    assert.deepEqual(await prepareVerification(options), {
      challenge: current,
      needsManual: true,
    });
  }
});
test("manual entry after a rejected automatic answer skips the reader", async () => {
  const { calls, options } = setup({
    challenge: current,
    manual: true,
    answer: " xyz789 ",
  });
  assert.deepEqual(await prepareVerification(options), {
    challenge: current,
    answer: "XYZ789",
  });
  assert.deepEqual(calls, []);
});
test("expired manual answers are discarded and a fresh image awaits user input", async () => {
  const { calls, options } = setup({
    challenge: { ...current, expiresAt: 99 },
    manual: true,
    answer: "OLD234",
  });
  assert.deepEqual(await prepareVerification(options), {
    challenge: current,
    needsManual: true,
  });
  assert.deepEqual(calls, ["load"]);
});
test("manual mode requires all six characters and never falls back to the reader", async () => {
  const { calls, options } = setup({
    challenge: current,
    manual: true,
    answer: "AB",
  });
  assert.equal((await prepareVerification(options)).needsManual, true);
  assert.deepEqual(calls, []);
});
test("Google verification stays a distinct error without invoking the image reader", async () => {
  const error = Object.assign(new Error("Google verification"), {
    code: "GOOGLE_VERIFICATION_REQUIRED",
  });
  const { calls, options } = setup({
    load: async () => {
      throw error;
    },
  });
  await assert.rejects(prepareVerification(options), { code: error.code });
  assert.deepEqual(calls, []);
});
