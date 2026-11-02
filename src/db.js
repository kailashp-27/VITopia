import { openDB } from "idb";
const db = () =>
  openDB("vtopia", 1, {
    upgrade(database) {
      database.createObjectStore("cache");
    },
  });
export async function readCache() {
  return (await db()).get("cache", "snapshot");
}
export async function saveCache(data) {
  await (await db()).put("cache", { version: 1, ...data }, "snapshot");
}
export async function clearCache() {
  await (await db()).clear("cache");
}
export async function readFacultyCabins() {
  return (await db()).get("cache", "facultyCabins");
}
export async function saveFacultyCabins(value) {
  await (await db()).put("cache", value, "facultyCabins");
}
