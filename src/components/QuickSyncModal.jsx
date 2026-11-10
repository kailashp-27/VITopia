import { useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useVtopSync } from "../hooks/useVtopSync.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";

export default function QuickSyncModal({
  online,
  data,
  sessionToken,
  onData,
  onSession,
  onCalendar,
  onOverview,
  onOpenSettings,
  onBusyChange,
  onClose,
}) {
  const started = useRef(false);
  const sync = useVtopSync({
    online,
    data,
    sessionToken,
    onData,
    onSession,
    onCalendar,
    onOverview,
    onMissingCredentials: () => {
      onClose();
      onOpenSettings();
    },
  });

  useEffect(() => {
    onBusyChange?.(sync.busy);
  }, [sync.busy, onBusyChange]);

  useEffect(() => {
    if (!sync.ready || started.current) return;
    if (sessionToken || (sync.username && sync.password)) {
      started.current = true;
      void sync.runSync();
    } else {
      onClose();
      onOpenSettings();
    }
  }, [sync.ready, sessionToken, sync.username, sync.password]);

  useEffect(() => {
    if (!sync.completed) return undefined;
    const timer = setTimeout(() => {
      onClose();
    }, 1100);
    return () => clearTimeout(timer);
  }, [sync.completed, onClose]);

  const handleClose = () => {
    sync.abortSync();
    onBusyChange?.(false);
    onClose();
  };

  useBackOverlay(true, handleClose);

  return (
    <div
      className="semester-modal-portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-sync-title"
    >
      <div
        className="semester-modal-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="semester-modal-box quick-sync-box">
        <div className="semester-modal-header">
          <h2 id="quick-sync-title">Quick Sync</h2>
          <button
            type="button"
            className="icon-button modal-close-btn"
            onClick={handleClose}
            aria-label="Close quick sync"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={sync.runSync} className="quick-sync-form">
          <div className="quick-sync-status-row" role="status" aria-live="polite">
            {sync.busy ? (
              <LoaderCircle className="spinning" size={18} />
            ) : sync.completed ? (
              <CheckCircle2 size={18} className="quick-sync-done-icon" />
            ) : (
              <RefreshCw size={18} />
            )}
            <span>
              {sync.progress ||
                (sync.username ? `Account: ${sync.username}` : "Ready to sync")}
            </span>
          </div>

          {sync.challenge && !sync.busy ? (
            <div className="verification-panel">
              <div className="captcha-label">
                <span>Verify to continue</span>
                <button
                  type="button"
                  className="text-button"
                  disabled={sync.busy}
                  onClick={sync.loadManualCaptcha}
                >
                  <RefreshCw size={13} /> New image
                </button>
              </div>
              <div className="captcha-box">
                <img
                  src={sync.challenge.image}
                  alt="VTOP verification image. Check the six characters below."
                />
                <span className={sync.expired ? "warning" : ""}>
                  {sync.expired
                    ? "Expired — get a new image"
                    : "Enter the six characters shown"}
                </span>
              </div>
              <label>
                <span className="sr-only">Captcha text</span>
                <input
                  name="captcha"
                  placeholder="Enter the 6 characters"
                  value={sync.captcha}
                  onChange={(e) => sync.setCaptcha(e.target.value.toUpperCase())}
                  maxLength={6}
                  minLength={6}
                  required
                  autoFocus
                  disabled={sync.busy || sync.expired}
                  autoComplete="off"
                />
              </label>
            </div>
          ) : null}

          {sync.error ? (
            <div className="form-message error" role="alert">
              {sync.error}
              {sync.errorCode === "GOOGLE_VERIFICATION_REQUIRED" ? (
                <a
                  className="verification-link"
                  href="https://vtopcc.vit.ac.in/vtop/login"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open official VTOP <ArrowUpRight size={14} />
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="semester-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={handleClose}
            >
              {sync.completed ? "Done" : "Cancel"}
            </button>
            {sync.challenge || sync.error ? (
              <button
                type="submit"
                className="button primary"
                disabled={sync.busy || !online}
                formNoValidate={!!sync.expired}
              >
                {sync.expired ? (
                  "Get new captcha"
                ) : sync.challenge ? (
                  <>
                    Verify and sync <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    Retry <RefreshCw size={14} />
                  </>
                )}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
