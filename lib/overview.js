import {
  parseTimetable,
  parseODReferences,
  parseODDetails,
  parseFeedbackStatus,
  parseRegisteredCourses,
  parseExamSchedule,
  parseStudentIdentity,
} from "./overview-parsers.js";
import { AppError } from "./errors.js";

const unavailable = (message) => ({ available: false, message });
export async function fetchOverview(client, semesterId, now = Date.now) {
  const deadline = now() + 75000;
  const safely = async (operation, message) => {
    try {
      return await operation();
    } catch (error) {
      if (error.code === "SESSION_EXPIRED") throw error;
      return unavailable(message);
    }
  };
  let courses = [];
  const timetable = await safely(async () => {
    const html = await client.authenticated("processViewTimeTable", {
      semesterSubId: semesterId,
    });
    courses = parseRegisteredCourses(html);
    return parseTimetable(html);
  }, "Timetable could not be read from VTOP.");
  const feedback = await safely(async () => {
    const page = await client.authenticated("processViewFeedBackStatus", {
      semesterSubId: semesterId,
    });
    return parseFeedbackStatus(page, semesterId, true);
  }, "Feedback status could not be read for this semester.");
  const exams = await safely(
    async () =>
      parseExamSchedule(
        await client.authenticated(
          "examinations/doSearchExamScheduleForStudent",
          { semesterSubId: semesterId },
        ),
      ),
    "Exam schedule could not be read from VTOP.",
  );
  const ods = await safely(async () => {
    await client.authenticated("academics/common/StudentAttendance", {
      verifyMenu: "true",
    });
    const html = await client.authenticated("processViewStudentAttendance", {
      semesterSubId: semesterId,
    });
    const refs = parseODReferences(html);
    if (!refs.length || refs.length > 40)
      return unavailable("OD attendance details were not available.");
    let entries = 0,
      hours = 0;
    // Bounded reads; incomplete totals are never displayed as zero or a full total.
    for (let i = 0; i < refs.length; i += 2) {
      if (now() > deadline - 18000)
        return unavailable(
          "OD details took too long. Try syncing again later.",
        );
      const batch = await Promise.all(
        refs.slice(i, i + 2).map(async (ref) =>
          parseODDetails(
            await client.authenticated("processViewAttendanceDetail", {
              semesterSubId: semesterId,
              classId: ref.classId,
              slotName: ref.slot,
            }),
          ),
        ),
      );
      entries += batch.reduce((sum, detail) => sum + detail.entries, 0);
      if (batch.some((detail) => detail.hours === null))
        return unavailable(
          "OD timings were incomplete; the hour total could not be calculated.",
        );
      hours += batch.reduce((sum, detail) => sum + detail.hours, 0);
    }
    return {
      available: true,
      entries,
      hours,
      limit: 40,
      coursesChecked: refs.length,
      unit: "class hours",
    };
  }, "OD details could not be read completely.");
  const profile =
    now() <= deadline - 18000
      ? await safely(
          async () =>
            parseStudentIdentity(
              await client.authenticated(
                "studentsRecord/StudentProfileAllView",
                { verifyMenu: "true" },
              ),
            ),
          "Profile identity could not be read.",
        )
      : {};
  return {
    semesterId,
    fetchedAt: new Date(now()).toISOString(),
    timetable,
    courses,
    profile,
    exams,
    ods,
    feedback,
  };
}

export function validateOverviewSemester(body, session) {
  if (!session.authorizedID)
    throw new AppError(
      "SESSION_EXPIRED",
      "Sync your account to fetch overview details.",
      401,
    );
  if (
    typeof body?.semesterId !== "string" ||
    !/^[A-Z0-9_-]{3,40}$/i.test(body.semesterId)
  )
    throw new AppError("INVALID_SEMESTER", "Select a valid semester.");
}
