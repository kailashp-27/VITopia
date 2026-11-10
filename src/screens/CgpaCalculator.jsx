import { useState, useMemo } from "react";
import {
  Award,
  Calculator,
  Target,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Info,
} from "lucide-react";
import { demo } from "../demo.js";

const GRADE_POINTS = {
  S: 10,
  A: 9,
  B: 8,
  C: 7,
  D: 6,
  E: 5,
  F: 0,
};

const GRADE_KEYS = ["S", "A", "B", "C", "D", "E", "F"];

export default function CgpaCalculator({ data, demoMode = false, onNavigate }) {
  const profile =
    data?.overview?.profile || (demoMode ? demo.overview?.profile : null);

  // Initialize from VTOP profile or defaults
  const initialCgpa = parseFloat(
    profile?.cgpa ||
      data?.overview?.cgpa ||
      data?.cgpa ||
      (demoMode ? "8.94" : "8.50"),
  );
  const initialCredits = parseFloat(
    profile?.creditsEarned ||
      data?.overview?.creditsEarned ||
      (demoMode ? "89.0" : "80.0"),
  );

  const [currentCgpaInput, setCurrentCgpaInput] = useState(
    isNaN(initialCgpa) ? "8.50" : initialCgpa.toFixed(2),
  );
  const [completedCreditsInput, setCompletedCreditsInput] = useState(
    isNaN(initialCredits) ? "80.0" : initialCredits.toFixed(1),
  );

  const currentCgpa = Math.min(
    10,
    Math.max(0, parseFloat(currentCgpaInput) || 0),
  );
  const completedCredits = Math.max(
    0,
    parseFloat(completedCreditsInput) || 0,
  );

  // Parse courses from current semester
  const registeredCourses = useMemo(() => {
    const raw =
      data?.overview?.courses?.length
        ? data.overview.courses
        : data?.attendance?.length
        ? data.attendance
        : demoMode
        ? demo.overview?.courses
        : [];

    if (!raw?.length) {
      // Default courses placeholder if none synced
      return [
        { id: "c1", code: "BCSE302L", title: "Database Systems", credits: 3, grade: "A" },
        { id: "c2", code: "BCSE302P", title: "Database Systems Lab", credits: 1, grade: "A" },
        { id: "c3", code: "BCSE303L", title: "Operating Systems", credits: 3, grade: "A" },
        { id: "c4", code: "BCSE303P", title: "Operating Systems Lab", credits: 1, grade: "A" },
        { id: "c5", code: "BCSE308L", title: "Computer Networks", credits: 3, grade: "A" },
        { id: "c6", code: "BSTS301P", title: "Soft Skills", credits: 1.5, grade: "A" },
      ];
    }

    // Extract unique course components with credits
    return raw.map((c, idx) => {
      const cr = Number(c.credits);
      return {
        id: `${c.code || "course"}-${idx}`,
        code: c.code || `Course ${idx + 1}`,
        title: c.title || c.code || "Registered Course",
        credits: Number.isFinite(cr) && cr > 0 ? cr : 3,
        grade: "A",
      };
    });
  }, [data, demoMode]);

  const [courses, setCourses] = useState(registeredCourses);
  const [tab, setTab] = useState("predict"); // "predict" | "target"
  const [targetCgpaInput, setTargetCgpaInput] = useState(
    (currentCgpa < 9.0 ? 9.0 : Math.min(10, currentCgpa + 0.2)).toFixed(2),
  );

  // Course management
  const updateGrade = (id, grade) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, grade } : c)),
    );
  };

  const updateCredits = (id, credits) => {
    const num = Math.max(0.5, Math.min(12, parseFloat(credits) || 1));
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, credits: num } : c)),
    );
  };

  const removeCourse = (id) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const addCustomCourse = () => {
    const newId = `custom-${Date.now()}`;
    setCourses((prev) => [
      ...prev,
      {
        id: newId,
        code: `ELECTIVE-${prev.length + 1}`,
        title: "Elective Course",
        credits: 3,
        grade: "A",
      },
    ]);
  };

  const setAllGrades = (grade) => {
    setCourses((prev) => prev.map((c) => ({ ...c, grade })));
  };

  const uniformGrade =
    courses.length > 0 && courses.every((c) => c.grade === courses[0]?.grade)
      ? courses[0].grade
      : null;

  // Calculations for Predictor
  const semesterCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const semesterPoints = courses.reduce(
    (sum, c) => sum + (c.credits || 0) * (GRADE_POINTS[c.grade] ?? 9),
    0,
  );
  const predictedGpa =
    semesterCredits > 0 ? semesterPoints / semesterCredits : 0;

  const totalCreditsAfter = completedCredits + semesterCredits;
  const predictedCgpa =
    totalCreditsAfter > 0
      ? (currentCgpa * completedCredits + semesterPoints) / totalCreditsAfter
      : currentCgpa;

  const cgpaDelta = predictedCgpa - currentCgpa;

  // Calculations for Targeter
  const targetCgpa = Math.min(
    10,
    Math.max(0, parseFloat(targetCgpaInput) || 0),
  );

  const requiredPointsTotal = targetCgpa * totalCreditsAfter;
  const currentPoints = currentCgpa * completedCredits;
  const requiredSemesterPoints = requiredPointsTotal - currentPoints;
  const requiredGpa =
    semesterCredits > 0 ? requiredSemesterPoints / semesterCredits : 0;

  const maxPossiblePoints = 10 * semesterCredits;
  const maxPossibleCgpa =
    totalCreditsAfter > 0
      ? (currentPoints + maxPossiblePoints) / totalCreditsAfter
      : currentCgpa;

  // Calculate recommended grade distribution for target
  const recommendation = useMemo(() => {
    if (requiredGpa <= 0 || targetCgpa <= currentCgpa) {
      return {
        status: "achieved",
        message: "Target already achieved with current CGPA!",
      };
    }
    if (requiredGpa > 10.0001) {
      // Future credits needed at 9.5 or 10.0 GPA
      const futureCreditsNeeded =
        targetCgpa < 9.5
          ? Math.ceil(
              ((targetCgpa - maxPossibleCgpa) * totalCreditsAfter) /
                (9.5 - targetCgpa),
            )
          : Math.ceil(
              ((targetCgpa - maxPossibleCgpa) * totalCreditsAfter) /
                (10.0 - targetCgpa),
            );

      return {
        status: "impossible",
        message: `Requires a GPA of ${requiredGpa.toFixed(2)} this semester (exceeds max 10.0).`,
        maxCgpa: maxPossibleCgpa.toFixed(2),
        futureCreditsNeeded: Math.max(1, futureCreditsNeeded),
      };
    }

    if (!courses.length || semesterCredits <= 0) {
      return {
        status: "achieved",
        message: "No registered courses found.",
      };
    }

    // Baseline integer grade point: e.g. 8 for 8.6, 9 for 9.2, minimum 5 (E)
    const baseGradePoint = Math.min(9, Math.max(5, Math.floor(requiredGpa)));
    const POINT_TO_GRADE = {
      10: "S",
      9: "A",
      8: "B",
      7: "C",
      6: "D",
      5: "E",
    };

    const plan = courses.map((c) => ({ ...c }));
    const grades = plan.map(() => baseGradePoint);
    let currentTotalPoints = plan.reduce(
      (sum, c, idx) => sum + (c.credits || 0) * grades[idx],
      0,
    );

    // Sort indices by course credits descending so high-credit courses are upgraded first
    const sortedIndices = plan
      .map((c, idx) => ({ idx, credits: c.credits || 0 }))
      .sort((a, b) => b.credits - a.credits)
      .map((item) => item.idx);

    let progress = true;
    while (currentTotalPoints < requiredSemesterPoints - 0.001 && progress) {
      progress = false;
      for (const i of sortedIndices) {
        if (grades[i] < 10) {
          grades[i] += 1;
          currentTotalPoints += plan[i].credits || 0;
          progress = true;
          if (currentTotalPoints >= requiredSemesterPoints - 0.001) {
            break;
          }
        }
      }
    }

    // Write computed grades back into plan
    for (let i = 0; i < plan.length; i++) {
      plan[i].grade = POINT_TO_GRADE[grades[i]] || "S";
    }

    // Compute distribution counts (e.g. 3x S, 2x A, 1x B)
    const counts = {};
    for (const c of plan) {
      counts[c.grade] = (counts[c.grade] || 0) + 1;
    }
    const planSummary = GRADE_KEYS.filter((g) => counts[g]).map((g) => ({
      grade: g,
      count: counts[g],
    }));

    return {
      status: "achievable",
      requiredGpa: requiredGpa.toFixed(2),
      plan,
      planSummary,
    };
  }, [
    requiredGpa,
    requiredSemesterPoints,
    targetCgpa,
    currentCgpa,
    maxPossibleCgpa,
    totalCreditsAfter,
    semesterCredits,
    courses,
  ]);

  const applyRecommendedPlan = () => {
    if (recommendation?.plan) {
      setCourses(recommendation.plan);
      setTab("predict");
    }
  };

  return (
    <div className="cgpa-calculator-screen" aria-label="CGPA Predictor & Targeter">
      {/* Header card with student's current baseline */}
      <section className="cgpa-baseline-card">
        <div className="baseline-header">
          <Award size={20} className="baseline-icon" aria-hidden="true" />
          <div>
            <h2>Academic Baseline</h2>
            <p>From your synced VTOP profile or custom input</p>
          </div>
        </div>
        <div className="baseline-inputs-grid">
          <div className="baseline-input-box">
            <label htmlFor="input-current-cgpa">Current CGPA</label>
            <div className="baseline-input-wrapper">
              <input
                id="input-current-cgpa"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={currentCgpaInput}
                onChange={(e) => setCurrentCgpaInput(e.target.value)}
              />
              <span className="unit-label">/ 10</span>
            </div>
          </div>
          <div className="baseline-input-box">
            <label htmlFor="input-completed-credits">Completed Credits</label>
            <div className="baseline-input-wrapper">
              <input
                id="input-completed-credits"
                type="number"
                step="0.5"
                min="0"
                max="300"
                value={completedCreditsInput}
                onChange={(e) => setCompletedCreditsInput(e.target.value)}
              />
              <span className="unit-label">credits</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="cgpa-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "predict"}
          className={`cgpa-tab ${tab === "predict" ? "active" : ""}`}
          onClick={() => setTab("predict")}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>CGPA Predictor</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "target"}
          className={`cgpa-tab ${tab === "target" ? "active" : ""}`}
          onClick={() => setTab("target")}
        >
          <Target size={16} aria-hidden="true" />
          <span>CGPA Targeter</span>
        </button>
      </div>

      {tab === "predict" ? (
        <section className="cgpa-predict-section" aria-label="CGPA Predictor">
          {/* Live Result Projection Card */}
          <div className="cgpa-projection-card">
            <div className="projection-main">
              <div className="projection-stat">
                <span className="projection-label">Predicted CGPA</span>
                <strong className="projection-value">
                  {predictedCgpa.toFixed(2)}
                </strong>
                <span
                  className={`cgpa-delta-pill ${
                    cgpaDelta > 0
                      ? "positive"
                      : cgpaDelta < 0
                      ? "negative"
                      : "neutral"
                  }`}
                >
                  {cgpaDelta > 0 ? `+${cgpaDelta.toFixed(2)} ▲` : cgpaDelta < 0 ? `${cgpaDelta.toFixed(2)} ▼` : "0.00"}
                </span>
              </div>
              <div className="projection-divider" aria-hidden="true" />
              <div className="projection-stat">
                <span className="projection-label">Semester GPA</span>
                <strong className="projection-value secondary">
                  {predictedGpa.toFixed(2)}
                </strong>
                <span className="projection-sub">
                  {semesterCredits.toFixed(1)} credits this sem
                </span>
              </div>
            </div>
            <div className="projection-footer">
              <span>
                Total Credits after semester:{" "}
                <strong>{totalCreditsAfter.toFixed(1)}</strong>
              </span>
            </div>
          </div>

          {/* Quick Bulk Actions */}
          <div className="cgpa-quick-actions">
            <span className="quick-label">Quick grades:</span>
            <div className="quick-buttons">
              <button
                type="button"
                className={`quick-grade-btn ${uniformGrade === "A" ? "active" : ""}`}
                onClick={() => setAllGrades("A")}
              >
                All A (9)
              </button>
              <button
                type="button"
                className={`quick-grade-btn ${uniformGrade === "S" ? "active" : ""}`}
                onClick={() => setAllGrades("S")}
              >
                All S (10)
              </button>
              <button
                type="button"
                className={`quick-grade-btn ${uniformGrade === "B" ? "active" : ""}`}
                onClick={() => setAllGrades("B")}
              >
                All B (8)
              </button>
              <button
                type="button"
                className="quick-grade-btn reset"
                onClick={() => setCourses(registeredCourses)}
                title="Reset to initial All A baseline"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Course Grade Cards List */}
          <div className="cgpa-course-list">
            <div className="course-list-header">
              <h3>Current Semester Courses ({courses.length})</h3>
              <button
                type="button"
                className="add-course-btn"
                onClick={addCustomCourse}
              >
                <Plus size={14} />
                <span>Add course</span>
              </button>
            </div>

            {courses.map((course) => (
              <article key={course.id} className="cgpa-course-card">
                <div className="cgpa-course-info">
                  <div className="course-titles">
                    <strong>{course.code}</strong>
                    <span className="course-name">{course.title}</span>
                  </div>
                  <div className="course-credits-control">
                    <label htmlFor={`credits-${course.id}`}>Credits:</label>
                    <input
                      id={`credits-${course.id}`}
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="12"
                      value={course.credits}
                      onChange={(e) => updateCredits(course.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="remove-course-btn"
                      onClick={() => removeCourse(course.id)}
                      title="Remove course"
                      aria-label={`Remove ${course.code}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grade-selector-row" role="radiogroup" aria-label={`Grade for ${course.code}`}>
                  {GRADE_KEYS.map((grade) => {
                    const isSelected = course.grade === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`grade-pill ${isSelected ? "selected" : ""} grade-${grade.toLowerCase()}`}
                        onClick={() => updateGrade(course.id, grade)}
                      >
                        <span className="grade-letter">{grade}</span>
                        <span className="grade-pts">{GRADE_POINTS[grade]}</span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        /* Targeter Section */
        <section className="cgpa-target-section" aria-label="CGPA Targeter">
          <div className="target-input-card">
            <div className="target-card-header">
              <Target size={20} className="target-icon" aria-hidden="true" />
              <div>
                <h2>Set Your Goal CGPA</h2>
                <p>Calculate the exact GPA needed this semester</p>
              </div>
            </div>

            <div className="target-number-row">
              <label htmlFor="target-cgpa-input">Goal Cumulative CGPA:</label>
              <div className="target-input-box">
                <input
                  id="target-cgpa-input"
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={targetCgpaInput}
                  onChange={(e) => setTargetCgpaInput(e.target.value)}
                />
                <span>/ 10.0</span>
              </div>
            </div>

            <div className="target-quick-pills">
              {[8.5, 8.75, 9.0, 9.25, 9.5].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`target-quick-pill ${
                    parseFloat(targetCgpaInput) === val ? "active" : ""
                  }`}
                  onClick={() => setTargetCgpaInput(val.toFixed(2))}
                >
                  {val.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Analysis Outcome */}
          <div className="target-result-card">
            {recommendation.status === "achieved" ? (
              <div className="target-banner achieved">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Target Already Achieved!</strong>
                  <p>
                    Your current CGPA ({currentCgpa.toFixed(2)}) is already at
                    or above your target ({targetCgpa.toFixed(2)}). Maintain
                    passing grades to stay on track.
                  </p>
                </div>
              </div>
            ) : recommendation.status === "impossible" ? (
              <div className="target-banner impossible">
                <AlertCircle size={24} />
                <div>
                  <strong>Not Achievable in a Single Semester</strong>
                  <p>
                    Reaching {targetCgpa.toFixed(2)} this semester requires a
                    GPA of <strong>{recommendation.requiredGpa || (requiredGpa > 0 ? requiredGpa.toFixed(2) : "10.00")}</strong>, which
                    exceeds the maximum 10.0.
                  </p>
                  <div className="target-alternative-stats">
                    <div className="alt-stat">
                      <span>Max CGPA this sem (All S):</span>
                      <strong>{recommendation.maxCgpa}</strong>
                    </div>
                    <div className="alt-stat">
                      <span>Est. future credits needed:</span>
                      <strong>~{recommendation.futureCreditsNeeded} credits</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary apply-plan-btn"
                    style={{ marginTop: "14px" }}
                    onClick={() => {
                      setAllGrades("S");
                      setTab("predict");
                    }}
                  >
                    <span>Aim for Max (Load All S into Predictor)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="target-banner achievable">
                <TrendingUp size={24} />
                <div>
                  <div className="target-gpa-badge">
                    <span>Required GPA this semester:</span>
                    <strong>{recommendation.requiredGpa}</strong>
                  </div>
                  <p>
                    To elevate your CGPA from {currentCgpa.toFixed(2)} to{" "}
                    {targetCgpa.toFixed(2)}, you need a GPA of at least{" "}
                    <strong>{recommendation.requiredGpa}</strong> across your{" "}
                    {semesterCredits.toFixed(1)} registered credits.
                  </p>
                  {recommendation.planSummary?.length ? (
                    <div className="plan-summary-row">
                      <span className="plan-summary-label">Target plan:</span>
                      <div className="plan-summary-pills">
                        {recommendation.planSummary.map((item) => (
                          <span
                            key={item.grade}
                            className={`plan-pill grade-${item.grade.toLowerCase()}`}
                          >
                            {item.count} × {item.grade}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="button primary apply-plan-btn"
                    onClick={applyRecommendedPlan}
                  >
                    <span>Load Recommended Grades into Predictor</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
