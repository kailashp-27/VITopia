import { useRef, useState } from "react";
import { LoaderCircle, Lock, RefreshCw, Shield, X } from "lucide-react";
import { fetchAdminUsers } from "../api-client.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
import { triggerLightHaptic } from "../native-bridge.js";

function formatAdminRelativeTime(isoString) {
  if (!isoString) return "—";
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 60 * 1000) return "Just now";
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return isoString;
  }
}

export default function AdminConsole() {
  const [tapCount, setTapCount] = useState(0);
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFetchError, setAdminFetchError] = useState("");
  const tapTimeoutRef = useRef(null);

  useBackOverlay(adminPinModalOpen, () => setAdminPinModalOpen(false));
  useBackOverlay(adminDashboardOpen, () => setAdminDashboardOpen(false));

  function handleVersionTap() {
    clearTimeout(tapTimeoutRef.current);
    const next = tapCount + 1;
    setTapCount(next);

    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 3500);

    // Silent counting — no prompt or countdown shown
    if (next >= 10) {
      void triggerLightHaptic();
      setTapCount(0);
      setPinInput("");
      setPinError("");
      setAdminPinModalOpen(true);
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    setPinError("");
    if (pinInput !== "27112006") {
      setPinError("Invalid admin PIN. Access denied.");
      return;
    }
    setAdminPinModalOpen(false);
    setAdminDashboardOpen(true);
    await loadAdminData("27112006");
  }

  async function loadAdminData(pin = "27112006") {
    setAdminLoading(true);
    setAdminFetchError("");
    try {
      const res = await fetchAdminUsers(pin);
      setAdminData(res);
    } catch (err) {
      setAdminFetchError(err.message || "Failed to load admin stats.");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <>
      <div className="settings-version-footer">
        <button
          type="button"
          className="version-tap-trigger"
          onClick={handleVersionTap}
        >
          Vtopia v1.2.0
        </button>
      </div>

      {/* Admin PIN Prompt Modal */}
      {adminPinModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setAdminPinModalOpen(false)}
        >
          <div
            className="dialog admin-pin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pin-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-pin-head">
              <div className="admin-icon-pill" aria-hidden="true">
                <Lock size={20} />
              </div>
              <h3 id="admin-pin-title">Admin Console</h3>
              <p>Enter administrator PIN to unlock telemetry</p>
            </div>

            <form onSubmit={handlePinSubmit} className="admin-pin-form">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={10}
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError("");
                }}
                className={`admin-pin-input ${pinError ? "has-error" : ""}`}
              />
              {pinError ? (
                <span className="admin-pin-error" role="alert">
                  {pinError}
                </span>
              ) : null}

              <div className="modal-actions admin-pin-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAdminPinModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Telemetry Dashboard Modal */}
      {adminDashboardOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setAdminDashboardOpen(false)}
        >
          <div
            className="admin-dashboard-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-dash-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-dash-header">
              <div className="admin-dash-title-group">
                <div className="admin-dash-badge">
                  <Shield size={14} />
                  <span>ADMIN CONSOLE</span>
                </div>
                <h3 id="admin-dash-heading">User Activity Telemetry</h3>
              </div>
              <div className="admin-dash-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Refresh admin data"
                  onClick={() => loadAdminData("27112006")}
                  disabled={adminLoading}
                >
                  <RefreshCw
                    size={16}
                    className={adminLoading ? "spinning" : ""}
                  />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close admin dashboard"
                  onClick={() => setAdminDashboardOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {adminFetchError ? (
              <div className="leave-alert error">{adminFetchError}</div>
            ) : null}

            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">Total Users</span>
                <strong className="admin-stat-value">
                  {adminData?.total ?? "—"}
                </strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Active Today</span>
                <strong className="admin-stat-value is-green">
                  {adminData?.activeToday ?? "—"}
                </strong>
              </div>
            </div>

            <div className="admin-user-roster-wrap">
              <span className="admin-roster-title">
                Logged In Students ({adminData?.users?.length || 0})
              </span>

              {adminLoading && !adminData ? (
                <div className="admin-loading-state">
                  <LoaderCircle size={20} className="spinning" />
                  <span>Loading user telemetry…</span>
                </div>
              ) : !adminData?.users?.length ? (
                <p className="empty-inline">No student activity logged yet.</p>
              ) : (
                <div className="admin-user-list" role="list">
                  {adminData.users.map((u, i) => {
                    const diffMs =
                      Date.now() - new Date(u.lastActive).getTime();
                    const isRecent = diffMs < 30 * 60 * 1000;
                    return (
                      <div
                        key={u.name + i}
                        className="admin-user-item"
                        role="listitem"
                      >
                        <div className="admin-user-main">
                          <span
                            className={`admin-status-dot ${isRecent ? "online" : ""}`}
                            aria-hidden="true"
                          />
                          <strong className="admin-user-name">
                            {u.name}
                          </strong>
                        </div>
                        <span className="admin-user-time">
                          {formatAdminRelativeTime(u.lastActive)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
