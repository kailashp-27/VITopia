import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { fetchHostelLeave } from "../api-client.js";
import "../hostel-leave.css";

export default function HostelLeave({
  data,
  token,
  online,
  demoMode,
  onSession,
  onLeave,
  onSync,
}) {
  const [tab, setTab] = useState("status");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const leave = demoMode ? null : data?.hostelLeave;
  const section = leave?.[tab];
  async function refresh() {
    if (busy) return;
    if (!token || demoMode) {
      onSync();
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
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
  return (
    <div className="hostel-leave-screen">
      <button
        className="button primary full-width"
        type="button"
        onClick={refresh}
        disabled={busy || !online || !data}
      >
        {busy ? (
          <LoaderCircle size={16} className="spinning" />
        ) : (
          <RefreshCw size={16} />
        )}
        {busy
          ? "Fetching leave details…"
          : !token || demoMode
            ? "Sync in Profile to fetch leave"
            : leave
              ? "Refresh from VTOP"
              : "Fetch from VTOP"}
      </button>
      <p className="footnote">
        View your hostel leave applications and history. Fetching here does not
        apply for or change any leave.
      </p>
      {!online ? (
        <p className="notice" role="status">
          Offline. Showing saved details when available.
        </p>
      ) : null}
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
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
      <div className="leave-tabs" role="group" aria-label="Hostel leave view">
        {[
          ["status", "Leave status"],
          ["history", "Leave history"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {leave?.[key]?.available ? ` (${leave[key].items.length})` : ""}
          </button>
        ))}
      </div>
      <section
        aria-label={tab === "status" ? "Leave status" : "Leave history"}
        aria-busy={busy}
      >
        {!leave ? (
          <p className="empty-inline">
            {data
              ? "No leave details fetched yet."
              : "Sync your account in Profile first."}
          </p>
        ) : !section?.available ? (
          <p className="empty-inline">
            {section?.message ||
              "These leave details are unavailable from VTOP."}
          </p>
        ) : (
          <>
            {section.stale ? (
              <p className="notice" role="status">
                Refresh failed for this section. Showing previously saved
                details. {section.message}
              </p>
            ) : null}
            {!section.items.length ? (
              <p className="empty-inline">
                {tab === "status"
                  ? "VTOP returned no current leave applications."
                  : "VTOP returned no leave history."}
              </p>
            ) : (
              section.items.map((item) => (
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
          </>
        )}
      </section>
    </div>
  );
}
