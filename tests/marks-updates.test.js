import test from "node:test";
import assert from "node:assert/strict";
import {
  newMarksCourses,
  unreadMarksCourses,
  marksCourseKey,
} from "../src/marks-updates.js";
const course = {
  code: "TEST101L",
  type: "Theory",
  components: [{ name: "CAT 1", scored: null, max: 50, weight: 15 }],
};
const snapshot = (marks) => ({ semester: { id: "SEM1" }, marks });
test("newly published zero and corrected scores notify; missing scores and first sync do not", () => {
  const before = snapshot([course]);
  const next = snapshot([
    {
      ...course,
      components: [{ name: "CAT 1", scored: 0, max: 50, weight: 15 }],
    },
  ]);
  assert.deepEqual(newMarksCourses(before, next), [marksCourseKey(course)]);
  assert.deepEqual(newMarksCourses(null, next), []);
  assert.deepEqual(newMarksCourses(next, next), []);
  assert.deepEqual(newMarksCourses(next, before), []);
  assert.deepEqual(
    newMarksCourses(
      next,
      snapshot([{ ...course, components: [{ name: "CAT 1", scored: 20 }] }]),
    ),
    [marksCourseKey(course)],
  );
});
test("reordered courses/components do not notify and unread survives repeated syncs until acknowledged", () => {
  const published = {
    ...course,
    components: [
      { name: "CAT 1", scored: 20 },
      { name: "DA 1", scored: 8 },
    ],
  };
  const before = {
    ...snapshot([published]),
    unreadMarks: [marksCourseKey(course)],
  };
  const next = snapshot([
    { ...published, components: [...published.components].reverse() },
  ]);
  assert.deepEqual(newMarksCourses(before, next), []);
  assert.deepEqual(unreadMarksCourses(before, next), [marksCourseKey(course)]);
  assert.deepEqual(
    unreadMarksCourses({ ...before, unreadMarks: [] }, next),
    [],
  );
  assert.deepEqual(
    unreadMarksCourses(before, { ...next, semester: { id: "SEM2" } }),
    [],
  );
});
test("new published components and courses notify; unmarked new courses do not", () => {
  const next = snapshot([
    {
      ...course,
      components: [...course.components, { name: "DA 1", scored: 9 }],
    },
  ]);
  assert.deepEqual(newMarksCourses(snapshot([course]), next), [
    marksCourseKey(course),
  ]);
  assert.deepEqual(newMarksCourses(snapshot([]), next), [
    marksCourseKey(course),
  ]);
  assert.deepEqual(newMarksCourses(snapshot([]), snapshot([course])), []);
});
