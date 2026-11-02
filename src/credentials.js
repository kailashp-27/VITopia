import { openDB } from "idb";
const database = () =>
  openDB("vtopia-credentials", 1, {
    upgrade(db) {
      db.createObjectStore("vault");
    },
  });
const aad = new TextEncoder().encode("vtopia-device-login-v1");
export async function encryptLogin(username, password) {
  if (!username || !password)
    throw new Error("Enter your username and password first.");
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    new TextEncoder().encode(JSON.stringify({ username, password })),
  );
  return { version: 1, key, iv, ciphertext };
}
export async function decryptLogin(record) {
  if (record.version !== 1) throw new Error("Unsupported saved login.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: record.iv, additionalData: aad },
    record.key,
    record.ciphertext,
  );
  const result = JSON.parse(new TextDecoder().decode(plaintext));
  if (
    typeof result.username !== "string" ||
    typeof result.password !== "string"
  )
    throw new Error("Invalid saved login.");
  return result;
}
export async function saveLogin(username, password) {
  const record = await encryptLogin(username, password);
  await (await database()).put("vault", record, "login");
}
export async function readLogin() {
  const record = await (await database()).get("vault", "login");
  return record ? decryptLogin(record) : null;
}
export async function clearLogin() {
  await (await database()).clear("vault");
}
