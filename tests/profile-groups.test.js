import test from "node:test";
import assert from "node:assert/strict";
import { groupCourses, groupExams } from "../src/profile-groups.js";

test("theory and lab share a heading while retaining separate faculty and credits", () => {
  const courses = [
    {
      code: "BCSE204P",
      title: "Design and Analysis of Algorithms Lab",
      type: "Lab Only",
      faculty: "Lab faculty",
      credits: 1,
    },
    {
      code: "BCSE204L",
      title: "Design and Analysis of Algorithms",
      type: "Theory Only",
      faculty: "Theory faculty",
      credits: 3,
    },
    { code: "OTHER", title: "Advanced Algorithms", type: "Theory Only" },
  ];
  const groups = groupCourses(courses);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].title, courses[1].title);
  assert.deepEqual(groups[0].items, courses.slice(0, 2));
});

test("exam aliases group together without merging CAT rounds", () => {
  const groups = groupExams([
    { examType: "FAT" },
    { examType: "CAT-III" },
    { examType: "Continuous Assessment Test - II" },
    { examType: "CAT 2" },
    { examType: "Final Assessment Test" },
    { examType: "Practical" },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.title, g.items.length]),
    [
      ["CAT 2", 2],
      ["CAT 3", 1],
      ["FAT", 2],
      ["Practical", 1],
    ],
  );
});
