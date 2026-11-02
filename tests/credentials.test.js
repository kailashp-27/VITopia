import test from "node:test";
import assert from "node:assert/strict";
import { encryptLogin, decryptLogin } from "../src/credentials.js";
test("device login encrypts, decrypts, and uses a non-extractable key", async () => {
  const encrypted = await encryptLogin("TEST_USER", "synthetic-test-password");
  assert.equal(encrypted.key.extractable, false);
  assert.equal(
    JSON.stringify(encrypted).includes("synthetic-test-password"),
    false,
  );
  assert.deepEqual(await decryptLogin(encrypted), {
    username: "TEST_USER",
    password: "synthetic-test-password",
  });
  await assert.rejects(crypto.subtle.exportKey("raw", encrypted.key));
  new Uint8Array(encrypted.ciphertext)[0] ^= 1;
  await assert.rejects(decryptLogin(encrypted));
});
