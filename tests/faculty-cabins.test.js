import test from "node:test";
import assert from "node:assert/strict";
import { findFacultyCabin } from "../src/faculty-cabins.js";
import { readFileSync } from "node:fs";
const directory = JSON.parse(
  readFileSync(new URL("../src/data/faculty-cabins.json", import.meta.url)),
);
test("PDF exact name and school match resolves the verified cabin", () => {
  assert.equal(
    findFacultyCabin("ALOK CHAUHAN - SCOPE", directory),
    "AB1 - 6F MAIN Cabin 7",
  );
  assert.equal(
    findFacultyCabin("Dr. Alok Chauhan - SCOPE", directory),
    "AB1 - 6F MAIN Cabin 7",
  );
});
test("different initials, different school, missing faculty and ambiguous cabins stay unavailable", () => {
  for (const name of [
    "EDWARD JERO - CEHMA",
    "PAVITHRA R - SAS",
    "KAVIPRIYA G - SCOPE",
    "ALOK CHAUHAN - SAS",
    "",
  ])
    assert.equal(findFacultyCabin(name, directory), null);
  assert.equal(
    findFacultyCabin("Test Name", [
      { name: "Test Name", cabin: "A" },
      { name: "Test Name", cabin: "B" },
    ]),
    null,
  );
});
