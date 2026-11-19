import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Clock,
} from "lucide-react";
import { fetchHostelLeave, submitHostelLeave } from "../api-client.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
import { demo } from "../demo.js";
import "../hostel-leave.css";

const LEAVE_TYPES = [
  "HOME TOWN",
  "OUTING",
  "EMERGENCY LEAVE",
  "LOCAL GUARDIAN",
  "WINTER VACATION",
  "SUMMER VACATION",
  "WITH PARENT LEAVE",
  "OFFICIAL LEAVES (GATE / CAMPUS INTERVIEW / ...)",
];

const REASON_PRESETS = [
  "Visiting home",
  "Movie",
  "College event",
];

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDateTime(dateStr, timeStr) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    let timeFormatted = timeStr || "";
    if (timeStr && timeStr.includes(":")) {
      const [h, min] = timeStr.split(":");
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 || 12;
      timeFormatted = `${String(h12).padStart(2, "0")}:${min} ${ampm}`;
    }
    return `${d} ${monthName} ${y}${timeFormatted ? ` at ${timeFormatted}` : ""}`;
  } catch {
    return `${dateStr} ${timeStr || ""}`;
  }
}

export default function HostelLeave({
  data,
  token,
  online,
  demoMode,
  onSession,
  onLeave,
  onSync,
}) {
  const [tab, setTab] = useState("request");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [formError, setFormError] = useState("");

  // Refs for triggering native calendar/clock pickers
  const fromDateRef = useRef(null);
  const fromTimeRef = useRef(null);
  const toDateRef = useRef(null);
  const toTimeRef = useRef(null);

  function triggerPicker(ref) {
    if (!ref.current) return;
    try {
      if (typeof ref.current.showPicker === "function") {
        ref.current.showPicker();
        return;
      }
    } catch {}
    ref.current.focus();
  }

  // Form State with user-requested defaults
  const todayIso = getTodayIso();
  const [leaveType, setLeaveType] = useState("HOME TOWN");
  const [visitingPlace, setVisitingPlace] = useState("Home");
  const [fromDate, setFromDate] = useState(todayIso);
  const [fromTime, setFromTime] = useState("16:30");
  const [toDate, setToDate] = useState(todayIso);
  const [toTime, setToTime] = useState("19:30");
  const [reason, setReason] = useState("Visiting home");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Local demo items when user submits in demo mode
  const [demoSubmissions, setDemoSubmissions] = useState([]);

  useBackOverlay(confirmOpen, () => {
    if (!submitting) setConfirmOpen(false);
  });

  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  const leave = demoMode ? null : data?.hostelLeave;

  // Proctor text
  const proctor =
    data?.overview?.profile?.proctor ||
    (demoMode ? demo.overview?.profile?.proctor : null);
  const proctorName = proctor?.name
    ? `PROCTOR NAME: ${proctor.name.toUpperCase()}${proctor.id ? ` (${proctor.id})` : ""}`
    : "PROCTOR NAME: SIVARAMAKRISHNAN N (53609)";

  // Items for status tab, merging any local demo items
  const statusItems = demoMode
    ? demoSubmissions
    : leave?.status?.items || [];
  const historyItems = leave?.history?.items || [];

  async function refresh() {
    if (busy || submitting) return;
    if (!token || demoMode) {
      onSync();
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const result = await fetchHostelLeave(
        token,
        AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
      );
      if (abort.signal.aborted) return;
      onSession(result.token);
      await onLeave(result.leave, data.syncedAt);
    } catch (failure) {
      if (abort.signal.aborted) return;
      if (failure.code === "SESSION_EXPIRED") {
        onSession(null);
        setError(
          "Your VTOP session expired. Sync in Profile, then return here and fetch leave details.",
        );
      } else
        setError(
          failure.name === "TimeoutError"
            ? "VTOP took too long. Try again later; your saved details are unchanged."
            : failure.message || "Leave details could not be fetched.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    setFormError("");
    setError("");

    if (!leaveType || leaveType === "-Select-") {
      setFormError("Please select a Leave Type.");
      return;
    }
    if (!visitingPlace.trim()) {
      setFormError("Please enter a Visiting Place.");
      return;
    }
    if (!fromDate || !fromTime) {
      setFormError("Please select departure date and time.");
      return;
    }
    if (!toDate || !toTime) {
      setFormError("Please select return date and time.");
      return;
    }

    const start = new Date(`${fromDate}T${fromTime}`);
    const end = new Date(`${toDate}T${toTime}`);
    if (end <= start) {
      setFormError("Return date & time must be after departure date & time.");
      return;
    }

    setConfirmOpen(true);
  }

  async function executeLeaveSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setFormError("");

    if (demoMode) {
      // Simulate submission in demo mode
      setTimeout(() => {
        const mockId = `LV${Math.floor(10000 + Math.random() * 90000)}`;
        const newDemoItem = {
          id: mockId,
          type: leaveType,
          from: formatDisplayDateTime(fromDate, fromTime),
          to: formatDisplayDateTime(toDate, toTime),
          status: "PROCTOR APPROVAL PENDING",
          appliedAt: new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          place: visitingPlace.trim(),
          reason: reason.trim() || visitingPlace.trim(),
          remarks: "-",
        };
        setDemoSubmissions((prev) => [newDemoItem, ...prev]);
        setSubmitting(false);
        setConfirmOpen(false);
        setSuccessMsg(
          `Leave request #${mockId} submitted successfully (Demo Mode). It is now pending proctor approval.`,
        );
        setTab("status");
        // Reset form to defaults
        setLeaveType("HOME TOWN");
        setVisitingPlace("Home");
        setReason("Visiting home");
      }, 700);
      return;
    }

    if (!online) {
      setSubmitting(false);
      setConfirmOpen(false);
      setError("Cannot apply while offline. Connect to the internet and try again.");
      return;
    }

    if (!token) {
      setSubmitting(false);
      setConfirmOpen(false);
      setError("Your VTOP session is not active. Sync in Profile before submitting leave.");
      return;
    }

    const abort = new AbortController();
    controller.current = abort;

    try {
      const applicationPayload = {
        leaveType,
        visitingPlace: visitingPlace.trim(),
        fromDate,
        fromTime,
        toDate,
        toTime,
        reason: reason.trim() || visitingPlace.trim(),
      };

      const result = await submitHostelLeave(
        token,
        applicationPayload,
        AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
      );

      if (abort.signal.aborted) return;
      onSession(result.token);
      if (result.leave) {
        await onLeave(result.leave, data.syncedAt);
      }

      setConfirmOpen(false);
      setSuccessMsg(
        result.message ||
          "Leave application submitted successfully to VTOP! It is now pending proctor approval.",
      );
      setTab("status");
      // Reset form fields to defaults
      setLeaveType("HOME TOWN");
      setVisitingPlace("Home");
      setReason("Visiting home");
    } catch (failure) {
      if (abort.signal.aborted) return;
      setConfirmOpen(false);
      if (failure.code === "SESSION_EXPIRED") {
        onSession(null);
        setError("Your VTOP session expired. Please Sync in Profile, then submit your leave.");
      } else {
        setError(
          failure.message ||
            "VTOP did not accept the leave application. Please check details and try again.",
        );
      }
    } finally {
      if (!abort.signal.aborted) setSubmitting(false);
    }
  }

  return (
    <div className="hostel-leave-screen">
      {/* Leave Navigation Tabs */}
      <div className="leave-tabs" role="group" aria-label="Hostel leave navigation">
        {[
          ["request", "Leave Request"],
          ["status", `Leave Status${statusItems.length ? ` (${statusItems.length})` : ""}`],
          ["history", `Leave History${historyItems.length ? ` (${historyItems.length})` : ""}`],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Global Notices / Alerts */}
      {successMsg ? (
        <div className="leave-alert success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      ) : null}

      {error ? (
        <div className="leave-alert error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {!online ? (
        <p className="notice" role="status">
          Offline. You can view saved records, but submitting requires internet connection.
        </p>
      ) : null}

      {/* TAB 1: LEAVE REQUEST FORM */}
      {tab === "request" && (
        <section aria-label="Apply for hostel leave" className="leave-request-section">
          {/* Proctor Information Banner */}
          <div className="proctor-banner" role="note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{proctorName}</span>
          </div>

          <form onSubmit={handleFormSubmit} className="leave-form" noValidate>
            {formError ? (
              <div className="leave-alert error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="leave-form-group">
              <label htmlFor="leave-type-select">Leave Type</label>
              <select
                id="leave-type-select"
                value={leaveType}
                onChange={(e) => {
                  setLeaveType(e.target.value);
                  setFormError("");
                }}
                className="leave-input"
              >
                <option value="">-Select-</option>
                {LEAVE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="leave-form-group">
              <label htmlFor="visiting-place-input">Visiting Place</label>
              <input
                id="visiting-place-input"
                type="text"
                value={visitingPlace}
                onChange={(e) => {
                  setVisitingPlace(e.target.value);
                  setFormError("");
                }}
                placeholder="e.g. Home, Bangalore, Relative's place"
                className="leave-input"
              />
            </div>

            {/* From Date & Time with Calendar & Clock Pickers */}
            <div className="leave-form-row">
              <div className="leave-form-group">
                <label htmlFor="from-date-input">From Date</label>
                <div
                  className="leave-input-wrapper"
                  onClick={() => triggerPicker(fromDateRef)}
                >
                  <input
                    ref={fromDateRef}
                    id="from-date-input"
                    type="date"
                    value={fromDate}
                    min={todayIso}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setFromDate(nextVal);
                      if (!toDate || toDate < nextVal) {
                        setToDate(nextVal);
                      }
                    }}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="leave-input leave-picker-input"
                  />
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Open calendar for from date"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPicker(fromDateRef);
                    }}
                  >
                    <Calendar size={16} />
                  </button>
                </div>
              </div>

              <div className="leave-form-group">
                <label htmlFor="from-time-input">Time From</label>
                <div
                  className="leave-input-wrapper"
                  onClick={() => triggerPicker(fromTimeRef)}
                >
                  <input
                    ref={fromTimeRef}
                    id="from-time-input"
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="leave-input leave-picker-input"
                  />
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Open clock for departure time"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPicker(fromTimeRef);
                    }}
                  >
                    <Clock size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* To Date & Time with Calendar & Clock Pickers */}
            <div className="leave-form-row">
              <div className="leave-form-group">
                <label htmlFor="to-date-input">To Date</label>
                <div
                  className="leave-input-wrapper"
                  onClick={() => triggerPicker(toDateRef)}
                >
                  <input
                    ref={toDateRef}
                    id="to-date-input"
                    type="date"
                    value={toDate}
                    min={fromDate || todayIso}
                    onChange={(e) => setToDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="leave-input leave-picker-input"
                  />
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Open calendar for return date"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPicker(toDateRef);
                    }}
                  >
                    <Calendar size={16} />
                  </button>
                </div>
              </div>

              <div className="leave-form-group">
                <label htmlFor="to-time-input">Time To</label>
                <div
                  className="leave-input-wrapper"
                  onClick={() => triggerPicker(toTimeRef)}
                >
                  <input
                    ref={toTimeRef}
                    id="to-time-input"
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="leave-input leave-picker-input"
                  />
                  <button
                    type="button"
                    className="picker-icon-btn"
                    aria-label="Open clock for return time"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerPicker(toTimeRef);
                    }}
                  >
                    <Clock size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Reason with Quick Chips and Autocomplete Input */}
            <div className="leave-form-group">
              <label htmlFor="leave-reason-input">
                Reason
              </label>

              {/* Quick Preset Chips */}
              <div
                className="leave-reason-presets"
                role="group"
                aria-label="Quick reason presets"
              >
                {REASON_PRESETS.map((preset) => {
                  const isSelected =
                    reason.trim().toLowerCase() === preset.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={preset}
                      className={`reason-chip ${isSelected ? "active" : ""}`}
                      onClick={() => {
                        setReason(preset);
                        setFormError("");
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <input
                id="leave-reason-input"
                type="text"
                list="leave-reason-options"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Choose a preset above or type your own reason"
                className="leave-input"
              />
              <datalist id="leave-reason-options">
                {REASON_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </div>

            <button
              type="submit"
              className="leave-submit-btn"
              disabled={submitting || busy}
            >
              {submitting ? (
                <>
                  <LoaderCircle size={16} className="spinning" />
                  Submitting to VTOP…
                </>
              ) : (
                "Submit Leave Application"
              )}
            </button>
          </form>

          <p className="footnote leave-footnote">
            Submitting here applies for hostel leave directly on the VTOP portal.
            The leave request will follow VIT&apos;s standard approval workflow through your proctor and block warden.
          </p>
        </section>
      )}

      {/* TAB 2 & 3: LEAVE STATUS & LEAVE HISTORY */}
      {tab !== "request" && (
        <section
          aria-label={tab === "status" ? "Leave status" : "Leave history"}
          aria-busy={busy}
        >
          <div className="leave-controls-bar">
            <button
              className="button primary full-width"
              type="button"
              onClick={refresh}
              disabled={busy || !online || (!data && !demoMode)}
            >
              {busy ? (
                <LoaderCircle size={16} className="spinning" />
              ) : (
                <RefreshCw size={16} />
              )}
              {busy
                ? "Fetching leave details…"
                : !token && !demoMode
                  ? "Sync in Profile to fetch leave"
                  : leave
                    ? "Refresh from VTOP"
                    : "Fetch from VTOP"}
            </button>
          </div>

          {leave ? (
            <p className="leave-updated">
              Last checked{" "}
              {new Date(leave.fetchedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}

          {/* Records Display */}
          {tab === "status" ? (
            statusItems.length === 0 ? (
              <p className="empty-inline">
                {demoMode
                  ? "No active leave applications in demo. Use the Leave Request tab to apply!"
                  : leave
                    ? "VTOP returned no current leave applications."
                    : "No leave status fetched yet. Fetch from VTOP to view."}
              </p>
            ) : (
              statusItems.map((item) => (
                <article className="leave-record" key={item.id}>
                  <header>
                    <h2>{item.type || "Hostel leave"}</h2>
                    <span className="leave-status">{item.status}</span>
                  </header>
                  <p className="leave-reference">Leave #{item.id}</p>
                  <dl>
                    <div>
                      <dt>From</dt>
                      <dd>{item.from}</dd>
                    </div>
                    <div>
                      <dt>To</dt>
                      <dd>{item.to}</dd>
                    </div>
                    {[
                      ["Applied", item.appliedAt],
                      ["Place", item.place],
                      ["Reason", item.reason],
                      ["Remarks", item.remarks],
                    ]
                      .filter(([, value]) => value && value !== "-")
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                </article>
              ))
            )
          ) : historyItems.length === 0 ? (
            <p className="empty-inline">
              {leave
                ? "VTOP returned no leave history."
                : "No leave history fetched yet. Fetch from VTOP to view."}
            </p>
          ) : (
            historyItems.map((item) => (
              <article className="leave-record" key={item.id}>
                <header>
                  <h2>{item.type || "Hostel leave"}</h2>
                  <span className="leave-status">{item.status}</span>
                </header>
                <p className="leave-reference">Leave #{item.id}</p>
                <dl>
                  <div>
                    <dt>From</dt>
                    <dd>{item.from}</dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>{item.to}</dd>
                  </div>
                  {[
                    ["Applied", item.appliedAt],
                    ["Place", item.place],
                    ["Reason", item.reason],
                    ["Remarks", item.remarks],
                  ]
                    .filter(([, value]) => value && value !== "-")
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
              </article>
            ))
          )}
        </section>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !submitting && setConfirmOpen(false)}
        >
          <div
            className="leave-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-leave-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-leave-title">Confirm Leave Application</h3>
            <p className="leave-confirm-intro">
              Please double check your leave details before submitting to VTOP:
            </p>

            <dl className="leave-confirm-list">
              <div>
                <dt>Leave Type</dt>
                <dd>{leaveType}</dd>
              </div>
              <div>
                <dt>Visiting Place</dt>
                <dd>{visitingPlace}</dd>
              </div>
              <div>
                <dt>Departure</dt>
                <dd>{formatDisplayDateTime(fromDate, fromTime)}</dd>
              </div>
              <div>
                <dt>Return</dt>
                <dd>{formatDisplayDateTime(toDate, toTime)}</dd>
              </div>
              {reason.trim() ? (
                <div>
                  <dt>Reason</dt>
                  <dd>{reason}</dd>
                </div>
              ) : null}
            </dl>

            <p className="leave-confirm-warning">
              ⚠️ This submits an official request to the VTOP portal.
              Approvals from your proctor and hostel warden are required before leaving campus.
            </p>

            <div className="leave-confirm-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="leave-submit-btn confirm-submit-btn"
                onClick={executeLeaveSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={15} className="spinning" />
                    Submitting…
                  </>
                ) : (
                  "Confirm & Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}