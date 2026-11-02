import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictGlyph, decodePixels } from "../src/captcha-reader.js";
const model = JSON.parse(
  readFileSync(new URL("../src/vendor/vtop-model.json", import.meta.url)),
);
test("VTOP model dimensions match the six fixed-layout glyph windows", () => {
  assert.equal(model.weights.length, 528);
  assert.ok(
    model.weights.every(
      (row) => row.length === 32 && row.every(Number.isFinite),
    ),
  );
  assert.equal(model.biases.length, 32);
});
test("blank or wrong-sized images do not produce an automatic answer", () => {
  assert.equal(
    decodePixels(new Uint8Array(200 * 40 * 4).fill(255), model),
    null,
  );
  assert.throws(() => decodePixels(new Uint8Array(10), model));
});
test("classifier softmax stays finite with large scores", () => {
  const fixture = {
    weights: Array.from({ length: 528 }, () => Array(32).fill(0)),
    biases: Array.from({ length: 32 }, (_, i) => (i === 3 ? 1000 : -1000)),
  };
  assert.deepEqual(predictGlyph(Array(528).fill(0), fixture), {
    text: "D",
    confidence: 1,
    margin: 1,
  });
});
