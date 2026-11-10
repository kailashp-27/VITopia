import {
  parseTimetable,
  parseODReferences,
  parseODDetails,
  parseFeedbackStatus,
  parseRegisteredCourses,
  parseExamSchedule,
  parseStudentIdentity,
  parseCGPA,
  parseCreditsAndCGPA,
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
  const profile = await safely(
    async () => {
      // 1. Check VTOP home dashboard widget: get/dashboard/current/cgpa/credits
      // This is the direct endpoint VTOP's home screen calls for "CGPA and CREDIT Status"
      let dashboardCgpa = null;
      let dashboardCredits = null;
      try {
        const dashHtml = await client.authenticated(
          "get/dashboard/current/cgpa/credits",
        );
        const dashData = parseCreditsAndCGPA(dashHtml);
        if (dashData.cgpa) dashboardCgpa = dashData.cgpa;
        if (dashData.creditsEarned) dashboardCredits = dashData.creditsEarned;
      } catch {}

      // Try with verifyMenu if first call was denied
      if (!dashboardCgpa || !dashboardCredits) {
        try {
          const dashHtml = await client.authenticated(
            "get/dashboard/current/cgpa/credits",
            { verifyMenu: "true" },
          );
          const dashData = parseCreditsAndCGPA(dashHtml);
          if (dashData.cgpa && !dashboardCgpa) dashboardCgpa = dashData.cgpa;
          if (dashData.creditsEarned && !dashboardCredits)
            dashboardCredits = dashData.creditsEarned;
        } catch {}
      }

      // Fallback: check VTOP home page directly
      if (!dashboardCgpa || !dashboardCredits) {
        try {
          const homeHtml = await client.authenticated("home");
          const homeData = parseCreditsAndCGPA(homeHtml);
          if (homeData.cgpa && !dashboardCgpa) dashboardCgpa = homeData.cgpa;
          if (homeData.creditsEarned && !dashboardCredits)
            dashboardCredits = homeData.creditsEarned;
        } catch {}
      }

      // Fallback: check content page directly
      if (!dashboardCgpa || !dashboardCredits) {
        try {
          const contentHtml = await client.authenticated("content");
          const contentData = parseCreditsAndCGPA(contentHtml);
          if (contentData.cgpa && !dashboardCgpa) dashboardCgpa = contentData.cgpa;
          if (contentData.creditsEarned && !dashboardCredits)
            dashboardCredits = contentData.creditsEarned;
        } catch {}
      }

      const html = await client.authenticated(
        "studentsRecord/StudentProfileAllView",
        { verifyMenu: "true" },
      );
      const studentProfile = parseStudentIdentity(html);

      if (dashboardCgpa && !studentProfile.cgpa) {
        studentProfile.cgpa = dashboardCgpa;
      }
      if (dashboardCredits && !studentProfile.creditsEarned) {
        studentProfile.creditsEarned = dashboardCredits;
      }

      if (!studentProfile.cgpa || !studentProfile.creditsEarned) {
        // 2. Try StudentGradeHistory (cumulative across all semesters)
        try {
          const gradesHtml = await client.authenticated(
            "examinations/examGradeView/StudentGradeHistory",
            { verifyMenu: "true", nocache: String(Date.now()) },
          );
          const gradesData = parseCreditsAndCGPA(gradesHtml);
          if (gradesData.cgpa && !studentProfile.cgpa) studentProfile.cgpa = gradesData.cgpa;
          if (gradesData.creditsEarned && !studentProfile.creditsEarned)
            studentProfile.creditsEarned = gradesData.creditsEarned;
          if (!studentProfile.cgpa) {
            const cgpa = parseCGPA(gradesHtml);
            if (cgpa) studentProfile.cgpa = cgpa;
          }
        } catch {}
      }
      if (!studentProfile.cgpa || !studentProfile.creditsEarned) {
        // 3. Try StudentGradeView with current semesterId (VTOP shows CGPA in the summary table for the selected semester)
        try {
          const gradeViewHtml = await client.authenticated(
            "examinations/examGradeView/StudentGradeView",
            {
              semesterSubId: semesterId,
              verifyMenu: "true",
              nocache: String(Date.now()),
            },
          );
          const gvData = parseCreditsAndCGPA(gradeViewHtml);
          if (gvData.cgpa && !studentProfile.cgpa) studentProfile.cgpa = gvData.cgpa;
          if (gvData.creditsEarned && !studentProfile.creditsEarned)
            studentProfile.creditsEarned = gvData.creditsEarned;
          if (!studentProfile.cgpa) {
            const cgpa = parseCGPA(gradeViewHtml);
            if (cgpa) studentProfile.cgpa = cgpa;
          }
        } catch {}
      }
      if (!studentProfile.cgpa || !studentProfile.creditsEarned) {
        // 4. Fallback: Curriculum page (also displays cumulative CGPA and earned credits)
        try {
          const currHtml = await client.authenticated(
            "academics/common/Curriculum",
            { verifyMenu: "true", nocache: String(Date.now()) },
          );
          const currData = parseCreditsAndCGPA(currHtml);
          if (currData.cgpa && !studentProfile.cgpa) studentProfile.cgpa = currData.cgpa;
          if (currData.creditsEarned && !studentProfile.creditsEarned)
            studentProfile.creditsEarned = currData.creditsEarned;
          if (!studentProfile.cgpa) {
            const cgpa = parseCGPA(currHtml);
            if (cgpa) studentProfile.cgpa = cgpa;
          }
        } catch {}
      }
      if (!studentProfile.cgpa || !studentProfile.creditsEarned) {
        // 5. Fallback: StudentAcademicHistory
        try {
          const acadHtml = await client.authenticated(
            "academics/common/StudentAcademicHistory",
            { verifyMenu: "true", nocache: String(Date.now()) },
          );
          const acadData = parseCreditsAndCGPA(acadHtml);
          if (acadData.cgpa && !studentProfile.cgpa) studentProfile.cgpa = acadData.cgpa;
          if (acadData.creditsEarned && !studentProfile.creditsEarned)
            studentProfile.creditsEarned = acadData.creditsEarned;
          if (!studentProfile.cgpa) {
            const cgpa = parseCGPA(acadHtml);
            if (cgpa) studentProfile.cgpa = cgpa;
          }
        } catch {}
      }
      return studentProfile;
    },
    "Profile identity could not be read.",
  );
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
  return {
    semesterId,
    fetchedAt: new Date(now()).toISOString(),
    timetable,
    courses,
    profile,
    cgpa: profile?.cgpa || null,
    creditsEarned: profile?.creditsEarned || null,
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
