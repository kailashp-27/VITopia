import { groupCourses, groupExams } from "../profile-groups.js";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { findFacultyCabin } from "../faculty-cabins.js";
import { readFacultyCabins, saveFacultyCabins } from "../db.js";

export default function ProfileDetails({ data, page, onNavigate }) {
  const registered = data?.overview?.courses;
  const courses = registered?.length ? registered : data?.attendance || [];
  const exams = data?.overview?.exams;
  const [cabins, setCabins] = useState({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  useEffect(() => {
    let active = true;
    readFacultyCabins()
      .then((value) => {
        if (active && value) setCabins(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const facultyFor = (course) =>
    course.faculty ||
    data?.overview?.timetable?.classes?.find(
      (item) => item.code === course.code,
    )?.faculty ||
    "";
  async function lookupCabins() {
    if (lookupBusy) return;
    setLookupBusy(true);
    setLookupMessage("");
    try {
      const { default: directory } =
        await import("../data/faculty-cabins.json");
      const names = [...new Set(courses.map(facultyFor).filter(Boolean))];
      const results = Object.fromEntries(
        names.map((name) => [name, findFacultyCabin(name, directory)]),
      );
      const next = { ...cabins, ...results };
      setCabins(next);
      const found = Object.values(results).filter(Boolean).length;
      setLookupMessage(
        `${found} of ${names.length} faculty entries matched. Other cabins are not available.`,
      );
      try {
        await saveFacultyCabins(next);
      } catch {
        setLookupMessage(
          `${found} matched. Results could not be saved on this device.`,
        );
      }
    } catch {
      setLookupMessage("The directory could not be opened. Please try again.");
    } finally {
      setLookupBusy(false);
    }
  }
  return (
    <div className="profile-details">
      {page === "profile" ? (
        <nav className="profile-page-list" aria-label="Profile sections">
          <button onClick={() => onNavigate("courses")}>
            Course list <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("exams")}>
            Exam schedule <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("simulator")}>
            Attendance Simulator <span aria-hidden="true">›</span>
          </button>
          <button onClick={() => onNavigate("hostel-leave")}>
            Hostel leave <span aria-hidden="true">›</span>
          </button>
        </nav>
      ) : null}
      {page === "courses" ? (
        <>
          <section aria-label="Current semester courses">
            <button
              type="button"
              className="button secondary full-width faculty-lookup"
              disabled={lookupBusy || !courses.length}
              onClick={lookupCabins}
            >
              {lookupBusy ? "Looking up cabins…" : "Look up faculty cabins"}
            </button>
            <p className="footnote">
              From your faculty directory PDF (March 2022). Cabin locations may
              have changed.
            </p>
            {lookupMessage ? (
              <p className="footnote" role="status">
                {lookupMessage}
              </p>
            ) : null}
            {courses.length ? (
              groupCourses(courses).map((group) => (
                <article
                  className="profile-course grouped-course"
                  key={group.items.map((course) => course.code).join("-")}
                >
                  <h2>{group.title}</h2>
                  {group.items.map((course) => (
                    <div
                      className="course-component"
                      key={`${course.code}-${course.type}`}
                    >
                      <span>
                        {course.code} · {course.type || "Course"}
                      </span>
                      <span className="course-faculty">
                        Faculty:{" "}
                        {facultyFor(course) || "Not available — sync to fetch"}
                      </span>
                      <small>
                        Cabin:{" "}
                        {cabins[facultyFor(course)] ||
                          course.cabin ||
                          "Not available"}
                      </small>
                      <small>
                        {Number.isFinite(course.credits)
                          ? `${course.credits} credits`
                          : "Credits not available"}
                        {course.slot ? ` · ${course.slot}` : ""}
                      </small>
                    </div>
                  ))}
                </article>
              ))
            ) : (
              <p className="empty-inline">
                No courses synced for this semester.
              </p>
            )}
          </section>
        </>
      ) : null}
      {page === "exams" ? (
        <>
          <section aria-label="Semester exam schedule">
            {!exams?.available ? (
              <p className="empty-inline">
                Exam schedule not available. Sync to fetch it from VTOP.
              </p>
            ) : !exams.items.length ? (
              <p className="empty-inline">
                VTOP has not published exams for this semester.
              </p>
            ) : (
              groupExams(exams.items).map((group) => (
                <details
                  className="exam-group"
                  key={group.title}
                  aria-label={group.title}
                >
                  <summary>
                    <h2>{group.title}</h2>
                    <span>{group.items.length} exams</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div className="exam-list">
                    {group.items.map((exam, i) => {
                      const matches = courses.filter(
                        (c) =>
                          c.code === exam.code ||
                          (exam.slot &&
                            c.slot
                              ?.split("+")
                              .includes(exam.slot.split("+")[0])),
                      );
                      const title =
                        exam.title ||
                        (matches.length === 1 ? matches[0].title : "");
                      return (
                        <article
                          className="exam-row"
                          key={`${exam.examType}-${exam.slot}-${exam.date}-${i}`}
                        >
                          <div className="exam-date">
                            <span>{exam.date || "Date pending"}</span>
                            <small>{exam.time || "Time pending"}</small>
                          </div>
                          <div className="exam-info">
                            <h3>
                              {title ||
                                (exam.slot
                                  ? `Slot ${exam.slot}`
                                  : exam.code || "Examination")}
                            </h3>
                            <p className="exam-meta">
                              <span>
                                {[exam.venue, exam.location]
                                  .filter(Boolean)
                                  .join(" · ") || "Venue pending"}
                              </span>
                              {exam.seat ? <span>Seat {exam.seat}</span> : null}
                              {exam.slot ? <span>Slot {exam.slot}</span> : null}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              ))
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
