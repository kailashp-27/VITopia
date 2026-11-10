import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import {
  encodeTimetableShare,
  decodeTimetableShare,
  compareTimetables,
  getClassForPeriod,
  PERIODS,
  DAYS_OF_WEEK,
} from "../src/timetable-share.js";

test("encodeTimetableShare and decodeTimetableShare round-trip successfully", () => {
  const classes = [
    {
      code: "BCSE302L",
      title: "Database Systems",
      day: "MON",
      start: "08:00",
      end: "08:50",
      slot: "A1",
      venue: "AB3-205",
      type: "Theory",
    },
    {
      code: "BCSE302P",
      title: "Database Lab",
      day: "WED",
      start: "14:00",
      end: "15:40",
      slot: "L1+L2",
      venue: "AB1-402",
      type: "Lab",
    },
  ];

  const shareCode = encodeTimetableShare("Kailash", "21BCE1001", classes);
  assert.ok(shareCode.startsWith("vtopia:tt:"));

  const decoded = decodeTimetableShare(shareCode);
  assert.ok(decoded);
  assert.equal(decoded.name, "Kailash");
  assert.equal(decoded.regNo, "21BCE1001");
  assert.equal(decoded.classes.length, 2);
  assert.equal(decoded.classes[0].code, "BCSE302L");
  assert.equal(decoded.classes[0].venue, "AB3-205");
  assert.equal(decoded.classes[1].slot, "L1+L2");
});

test("decodeTimetableShare gracefully handles malformed input", () => {
  assert.equal(decodeTimetableShare(null), null);
  assert.equal(decodeTimetableShare(""), null);
  assert.equal(decodeTimetableShare("not-a-valid-base64-json"), null);
  assert.equal(decodeTimetableShare("vtopia:tt:invalid!"), null);
});

test("getClassForPeriod matches single and multi-period classes across 12 blocks", () => {
  const classes = [
    { code: "BCSE302L", title: "DBMS", day: "MON", start: "08:00", end: "08:50", venue: "AB3-205" },
    { code: "BCSE303L", title: "OS", day: "MON", start: "12:35", end: "13:20", venue: "AB3-201" },
    { code: "BCSE302P", title: "DBMS Lab", day: "MON", start: "14:00", end: "15:40", venue: "AB1-402" },
  ];

  const p1 = PERIODS.find((p) => p.id === 1); // 08:00 - 08:50
  const p2 = PERIODS.find((p) => p.id === 2); // 08:55 - 09:45
  const p6 = PERIODS.find((p) => p.id === 6); // 12:35 - 13:20 (before lunch 13:20-14:00)
  const p7 = PERIODS.find((p) => p.id === 7); // 14:00 - 14:50 (after lunch)
  const p8 = PERIODS.find((p) => p.id === 8); // 14:55 - 15:45

  assert.equal(PERIODS.length, 12);
  assert.equal(p6.end, "13:20");
  assert.equal(p7.start, "14:00");
  assert.equal(getClassForPeriod(classes, "MON", p1)?.code, "BCSE302L");
  assert.equal(getClassForPeriod(classes, "MON", p2), null);
  assert.equal(getClassForPeriod(classes, "MON", p6)?.code, "BCSE303L");
  assert.equal(getClassForPeriod(classes, "MON", p7)?.code, "BCSE302P");
  assert.equal(getClassForPeriod(classes, "MON", p8)?.code, "BCSE302P"); // 2-period lab covers P7 and P8
});

test("compareTimetables distinguishes matching vs different classrooms for same course", () => {
  const myClasses = [
    { code: "BCSE302L", title: "DBMS", day: "MON", start: "08:00", end: "08:50", venue: "AB3-205" },
    { code: "BCSE301L", title: "Software Engineering", day: "THU", start: "08:00", end: "08:50", venue: "AB3-608" },
    { code: "BCSE303L", title: "OS", day: "MON", start: "08:55", end: "09:45", venue: "AB3-201" },
    { code: "MATH201L", title: "Math", day: "MON", start: "14:00", end: "14:50", venue: "TT-412" },
  ];

  const friendClasses = [
    { code: "BCSE302L", title: "DBMS", day: "MON", start: "08:00", end: "08:50", venue: "AB3-205" },
    { code: "BCSE301L", title: "Software Engineering", day: "THU", start: "08:00", end: "08:50", venue: "AB3-508" },
    { code: "ENG101L", title: "English", day: "MON", start: "09:50", end: "10:40", venue: "TT-101" },
    { code: "PHY101L", title: "Physics", day: "MON", start: "14:55", end: "15:45", venue: "PR-301" },
  ];

  const monComparison = compareTimetables(myClasses, friendClasses, "MON");
  assert.equal(monComparison.sharedClasses.length, 1);
  assert.equal(monComparison.sharedClasses[0].code, "BCSE302L");
  assert.equal(monComparison.sharedClasses[0].sameVenue, true);

  const thuComparison = compareTimetables(myClasses, friendClasses, "THU");
  assert.equal(thuComparison.sharedClasses.length, 1);
  assert.equal(thuComparison.sharedClasses[0].code, "BCSE301L");
  assert.equal(thuComparison.sharedClasses[0].sameVenue, false);

  assert.ok(monComparison.commonFreeSlots.length > 0);
  const lunchSlot = monComparison.commonFreeSlots.find(
    (slot) => slot.start <= "11:30" && slot.end >= "13:30",
  );
  assert.ok(lunchSlot, "Found lunch free slot together");
});

test("encodeTimetableShare stays compact enough for QRCode generation with 35 classes", async () => {
  const fullClasses = Array.from({ length: 35 }, (_, i) => ({
    code: `BCSE${301 + (i % 7)}L`,
    title: `Advanced Distributed Computer Architecture ${i % 7}`,
    day: DAYS_OF_WEEK[i % 5],
    start: PERIODS[i % 8].start,
    end: PERIODS[i % 8].end,
    slot: `A${(i % 6) + 1}`,
    venue: `AB3-${201 + (i % 7)}`,
    type: i % 7 === 6 ? "Lab" : "Theory",
  }));

  const shareCode = encodeTimetableShare("Kailash P", "23BCE1042", fullClasses);
  const qrDataUrl = await QRCode.toDataURL(shareCode, {
    errorCorrectionLevel: "L",
    width: 250,
    margin: 2,
  });
  assert.ok(qrDataUrl.startsWith("data:image/png;base64,"));

  // Also test resilient decoding with whitespace and chat text around token
  const noisyCopy = `Check my VIT timetable:\n  ${shareCode.slice(0, 40)}\n${shareCode.slice(40)}  \nSent via VITopia`;
  const decoded = decodeTimetableShare(noisyCopy);
  assert.ok(decoded);
  assert.equal(decoded.name, "Kailash P");
  assert.equal(decoded.regNo, "23BCE1042");
  assert.equal(decoded.classes.length, 35);
});
