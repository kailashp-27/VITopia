import { openDB } from "idb";
const db = () =>
  openDB("vtopia-events", 1, {
    upgrade(database) {
      database.createObjectStore("events", { keyPath: "id" });
    },
  });
export async function readEvents() {
  return (await db()).getAll("events");
}
export async function addEvent(event) {
  await (await db()).put("events", event);
}
export async function removeEvent(id) {
  await (await db()).delete("events", id);
}
export async function clearEvents() {
  await (await db()).clear("events");
}
