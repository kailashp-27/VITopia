import { Fragment, useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  ArrowLeft,
  QrCode,
  UserPlus,
  Users,
  Copy,
  Check,
  Download,
  Camera,
  Upload,
  X,
  MapPin,
  AlertCircle,
} from "lucide-react";
import {
  encodeTimetableShare,
  decodeTimetableShare,
  getClassForPeriod,
  getSavedFriends,
  saveFriend,
  removeFriend,
  updateFriendColor,
  PERIODS,
  DAYS_OF_WEEK,
  FRIEND_COLORS,
} from "../timetable-share.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";

const DAY_SHORT = {
  MON: "Mo",
  TUE: "Tu",
  WED: "We",
  THU: "Th",
  FRI: "Fr",
};

function MatrixTimeHeader() {
  return (
    <div className="friend-matrix-axis" aria-hidden="true">
      <span className="friend-axis-spacer" />
      <span className="friend-axis-group">AM · 8:00–1:20</span>
      <span className="friend-axis-lunch" title="Lunch 1:20–2:00" />
      <span className="friend-axis-group">PM · 2:00–7:25</span>
    </div>
  );
}

// Sample friend for demo mode / optional preview
const DEFAULT_DEMO_FRIEND = {
  id: "friend_demo_student",
  name: "Student",
  regNo: "99REG0011",
  color: FRIEND_COLORS[0],
  classes: [
    { code: "BMAT201L", title: "Complex Variables", day: "MON", start: "08:00", end: "08:50", slot: "C1", venue: "TT-412" },
    { code: "BMAT201L", title: "Complex Variables", day: "MON", start: "08:55", end: "09:45", slot: "C2", venue: "TT-412" },
    { code: "BMAT201L", title: "Complex Variables", day: "MON", start: "09:50", end: "10:40", slot: "C3", venue: "TT-412" },
    { code: "BCSE303L", title: "Operating Systems", day: "MON", start: "14:00", end: "15:45", slot: "L1+L2", venue: "AB3-402" },
    { code: "BCSE303L", title: "Operating Systems", day: "MON", start: "15:50", end: "17:35", slot: "L3+L4", venue: "AB3-402" },
    { code: "BCSE303L", title: "Operating Systems", day: "TUE", start: "14:00", end: "16:40", slot: "L11+L12", venue: "AB1-305" },
    { code: "BCSE303L", title: "Operating Systems", day: "TUE", start: "16:45", end: "18:30", slot: "L13+L14", venue: "AB1-305" },
    { code: "BCSE308L", title: "Computer Networks", day: "WED", start: "08:55", end: "09:45", slot: "D1", venue: "AB3-305" },
    { code: "BCSE308L", title: "Computer Networks", day: "WED", start: "14:00", end: "16:40", slot: "L15+L16", venue: "AB3-205" },
    { code: "BENG101L", title: "Technical English", day: "THU", start: "11:40", end: "12:30", slot: "E1", venue: "TT-201" },
    { code: "BENG101L", title: "Technical English", day: "THU", start: "14:00", end: "16:40", slot: "L17+L18", venue: "TT-205" },
    { code: "BCSE309L", title: "Software Engineering", day: "FRI", start: "08:00", end: "09:45", slot: "L21+L22", venue: "AB2-101" },
    { code: "BCSE309L", title: "Software Engineering", day: "FRI", start: "14:00", end: "16:40", slot: "L23+L24", venue: "AB2-101" },
  ],
};

export default function ShareTimetable({
  data,
  demoMode = false,
  onNavigate,
  onBack,
}) {
  // Read current student name and registration from synced VTOP profile
  const profile = data?.overview?.profile || data?.profile || {};
  const studentName = profile.name || data?.student?.name || "Student";
  const regNo = profile.registration || profile.regNo || "";
  const accountKey = regNo || (demoMode ? "DEMO" : studentName);
  const myClasses = data?.overview?.timetable?.classes || data?.timetable?.classes || [];

  // Load saved friends scoped to the active account
  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);

  useEffect(() => {
    const saved = getSavedFriends(accountKey);
    const list = !saved.length && demoMode ? [DEFAULT_DEMO_FRIEND] : saved;
    setFriends(list);
    setSelectedFriendId((prev) =>
      prev === "ALL" && list.length > 1
        ? "ALL"
        : list.some((f) => f.id === prev)
          ? prev
          : list.length > 1
            ? "ALL"
            : list[0]?.id || null,
    );
  }, [accountKey, demoMode]);

  // Modals & Sheets
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState("camera"); // 'camera' | 'upload' | 'paste'
  const [pasteInput, setPasteInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusAlert, setStatusAlert] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // { day, period, friend }

  // Canvas & Video refs
  const qrCanvasRef = useRef(null);
  const videoRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Generate compact share code for current logged-in student
  const shareCode = encodeTimetableShare(studentName, regNo, myClasses);

  const isAllMode = friends.length > 1 && selectedFriendId === "ALL";
  const activeFriend = isAllMode
    ? null
    : friends.find((f) => f.id === selectedFriendId) || friends[0] || null;

  // Render QR Code in modal
  useEffect(() => {
    if (showQrModal && qrCanvasRef.current && myClasses.length > 0) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        shareCode,
        {
          width: 250,
          margin: 2,
          errorCorrectionLevel: "L",
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        },
      );
    }
  }, [showQrModal, shareCode, myClasses.length]);

  // Clean up camera stream
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useBackOverlay(Boolean(selectedCell), () => setSelectedCell(null));
  useBackOverlay(showQrModal, () => setShowQrModal(false));
  useBackOverlay(showAddModal, () => {
    stopCamera();
    setShowAddModal(false);
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!showAddModal || addMode !== "camera") {
      stopCamera();
    }
  }, [showAddModal, addMode]);

  // Start Camera
  const startCamera = async () => {
    setStatusAlert(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatusAlert({
          type: "error",
          text: "Camera not supported on this device. Use image upload or paste code.",
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        requestScanFrame();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setStatusAlert({
        type: "error",
        text: "Could not access camera. Please allow camera permissions or upload a QR image.",
      });
    }
  };

  const requestScanFrame = () => {
    animFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || !scanCanvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = scanCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        handleImportCode(code.data);
        return;
      }
    }
    requestScanFrame();
  };

  // Image file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleImportCode(code.data);
        } else {
          setStatusAlert({
            type: "error",
            text: "No valid QR code found in this image. Try another screenshot.",
          });
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Import code handler
  const handleImportCode = (raw) => {
    const decoded = decodeTimetableShare(raw);
    if (!decoded || !Array.isArray(decoded.classes) || !decoded.classes.length) {
      setStatusAlert({
        type: "error",
        text: "Invalid or empty timetable code. Make sure your friend has synced their VTOP timetable first.",
      });
      return;
    }

    // Prevent importing one's own timetable accidentally
    if (
      regNo &&
      decoded.regNo &&
      decoded.regNo.trim().toUpperCase() === regNo.trim().toUpperCase()
    ) {
      setStatusAlert({
        type: "error",
        text: "That’s your own timetable! Share it with a friend or scan your friend’s QR code.",
      });
      return;
    }

    stopCamera();
    const updated = saveFriend(decoded, accountKey);
    setFriends(updated);
    const newFriend =
      updated.find(
        (f) =>
          (decoded.regNo && f.regNo === decoded.regNo) ||
          f.name === decoded.name,
      ) || updated[0];
    setSelectedFriendId(newFriend?.id || null);
    setPasteInput("");
    setShowAddModal(false);
    setStatusAlert(null);
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareCode);
      } else {
        const el = document.createElement("textarea");
        el.value = shareCode;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareCode;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${studentName.replace(/\s+/g, "_")}_timetable_qr.png`;
    a.click();
  };

  const handleDeleteFriend = (id) => {
    if (id === DEFAULT_DEMO_FRIEND.id && !getSavedFriends(accountKey).length) {
      setFriends([]);
      setSelectedFriendId(null);
      return;
    }
    const updated = removeFriend(id, accountKey);
    setFriends(updated);
    if (selectedFriendId === id) {
      setSelectedFriendId(updated.length ? updated[0].id : null);
    }
  };

  const cycleFriendColor = (id) => {
    const friend = friends.find((f) => f.id === id);
    if (!friend) return;
    const currentColorHex = friend.color?.hex;
    const currentIdx = FRIEND_COLORS.findIndex((c) => c.hex === currentColorHex);
    const nextIdx = (currentIdx + 1) % FRIEND_COLORS.length;
    const nextColor = FRIEND_COLORS[nextIdx];
    const updated = updateFriendColor(id, nextColor, accountKey);
    setFriends(updated.length ? updated : friends.map((f) => (f.id === id ? { ...f, color: nextColor } : f)));
  };

  const handleCellClick = (day, period, friend = null) => {
    const myClass = getClassForPeriod(myClasses, day, period);
    if (!friend && isAllMode) {
      const friendEntries = friends.map((f) => ({
        friend: f,
        friendClass: getClassForPeriod(f.classes, day, period),
      }));
      setSelectedCell({
        day,
        period,
        mode: "all",
        myClass,
        friendEntries,
      });
      return;
    }

    const targetFriend = friend || activeFriend;
    const friendClass = targetFriend
      ? getClassForPeriod(targetFriend.classes, day, period)
      : null;

    setSelectedCell({
      day,
      period,
      mode: "single",
      friend: targetFriend,
      myClass,
      friendClass,
    });
  };

  return (
    <div className="friend-schedule-container">
      {/* 1. Header matching user screenshot */}
      <header className="friend-schedule-header">
        <button
          type="button"
          className="friend-header-back"
          aria-label="Back to Profile"
          onClick={() => (onBack ? onBack() : onNavigate("profile"))}
        >
          <ArrowLeft size={22} />
        </button>
        <div className="friend-header-text">
          <h1 className="friend-header-title">Friends’ Schedule</h1>
          <span className="friend-header-subtitle">
            {studentName.toUpperCase()}
          </span>
        </div>
        <div className="friend-header-actions">
          <button
            type="button"
            className="friend-qr-icon-btn"
            aria-label="Show my QR Code"
            title="Show my timetable QR"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode size={20} />
          </button>
          <button
            type="button"
            className="friend-add-btn"
            onClick={() => {
              setStatusAlert(null);
              setShowAddModal(true);
            }}
          >
            <UserPlus size={16} />
            <span>Add Friends</span>
          </button>
        </div>
      </header>

      {/* 2. Card 1: MY SCHEDULE */}
      <section className="friend-card-section">
        <h2 className="friend-card-title">MY SCHEDULE</h2>
        <div className="friend-grid-matrix-box">
          <div className="friend-matrix-grid">
            <MatrixTimeHeader />
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="friend-matrix-row">
                <span className="friend-day-tag">{DAY_SHORT[day] || day}</span>
                {PERIODS.map((p) => {
                  const item = getClassForPeriod(myClasses, day, p);
                  return (
                    <Fragment key={p.id}>
                      <button
                        type="button"
                        className={`friend-slot-box ${item ? "is-booked-user" : "is-empty"}`}
                        aria-label={`${day} ${p.label} (${p.start}–${p.end}): ${item ? item.code || item.title : "Free"}`}
                        onClick={() => handleCellClick(day, p)}
                      />
                      {p.id === 6 ? (
                        <span
                          className="friend-lunch-divider"
                          aria-hidden="true"
                          title="Lunch break (13:20–14:00)"
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Card 2: FRIENDS (X/X) */}
      <section className="friend-card-section">
        <h2 className="friend-card-title">
          FRIENDS ({friends.length}/{friends.length})
        </h2>
        {friends.length === 0 ? (
          <div className="friend-empty-prompt">
            <p>No friends added yet.</p>
            <button
              type="button"
              className="friend-prompt-btn"
              onClick={() => {
                setStatusAlert(null);
                setShowAddModal(true);
              }}
            >
              <UserPlus size={15} />
              <span>Add Friend</span>
            </button>
          </div>
        ) : (
          <div className="friend-pills-row">
            {friends.length > 1 ? (
              <button
                type="button"
                className={`friend-chip-pill friend-all-pill ${isAllMode ? "selected" : ""}`}
                onClick={() => setSelectedFriendId("ALL")}
              >
                <span className="friend-chip-badge all-badge">
                  <Users size={12} />
                </span>
                <span className="friend-chip-label">
                  All Friends ({friends.length})
                </span>
              </button>
            ) : null}
            {friends.map((f) => {
              const isSelected = !isAllMode && f.id === activeFriend?.id;
              const color = f.color || FRIEND_COLORS[0];
              return (
                <div
                  key={f.id}
                  className={`friend-chip-pill ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedFriendId(f.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span
                    className="friend-chip-badge"
                    style={{ backgroundColor: color.hex }}
                  >
                    {(f.name || "S").charAt(0).toUpperCase()}
                  </span>
                  <span className="friend-chip-label">{f.name || "Student"}</span>
                  <button
                    type="button"
                    className="friend-chip-color-btn"
                    title="Change friend color"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleFriendColor(f.id);
                    }}
                  >
                    🎨
                  </button>
                  <button
                    type="button"
                    className="friend-chip-remove-btn"
                    title="Remove friend"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFriend(f.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Card 3: OVERALL SCHEDULES */}
      {friends.length > 0 && (isAllMode || activeFriend) ? (
        <section className="friend-card-section">
          <div className="friend-card-heading-row">
            <h2 className="friend-card-title">OVERALL SCHEDULES</h2>
            <span className="friend-mode-badge">
              {isAllMode
                ? `You + All (${friends.length})`
                : `You + ${activeFriend.name}`}
            </span>
          </div>
          <div className="friend-legend-row" aria-hidden="true">
            <span className="friend-legend-item">
              <i className="legend-dot user" /> You
            </span>
            {isAllMode ? (
              <span className="friend-legend-item">
                <i className="legend-dot all-free" /> Everyone free
              </span>
            ) : (
              <span className="friend-legend-item">
                <i
                  className="legend-dot"
                  style={{
                    backgroundColor: activeFriend.color?.hex || "#f59e0b",
                  }}
                />{" "}
                {activeFriend.name}
              </span>
            )}
          </div>
          <div className="friend-grid-matrix-box">
            <div className="friend-matrix-grid">
              <MatrixTimeHeader />
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="friend-matrix-row">
                  <span className="friend-day-tag">{DAY_SHORT[day] || day}</span>
                  {PERIODS.map((p) => {
                    const myClass = getClassForPeriod(myClasses, day, p);
                    let cellClass = "is-empty";
                    let customStyle = {};
                    let ariaDesc = "Free";

                    if (isAllMode) {
                      const busyFriends = friends.filter((f) =>
                        Boolean(getClassForPeriod(f.classes, day, p)),
                      );
                      if (!myClass && busyFriends.length === 0) {
                        cellClass = "is-all-free";
                        ariaDesc = "Everyone is free";
                      } else if (myClass && busyFriends.length === 0) {
                        cellClass = "is-booked-user";
                        ariaDesc = `Only you: ${myClass.code}`;
                      } else if (!myClass && busyFriends.length === 1) {
                        const fColor = busyFriends[0].color || FRIEND_COLORS[0];
                        cellClass = "is-booked-friend";
                        customStyle = { backgroundColor: fColor.hex };
                        ariaDesc = `${busyFriends[0].name} busy`;
                      } else {
                        const palette = [
                          ...(myClass ? ["var(--accent)"] : []),
                          ...busyFriends.map(
                            (f) => (f.color || FRIEND_COLORS[0]).hex,
                          ),
                        ];
                        const stops = palette
                          .map((c, idx) => {
                            const startPct = Math.round((idx / palette.length) * 100);
                            const endPct = Math.round(((idx + 1) / palette.length) * 100);
                            return `${c} ${startPct}% ${endPct}%`;
                          })
                          .join(", ");
                        cellClass = "is-booked-both";
                        customStyle = {
                          background: `linear-gradient(135deg, ${stops})`,
                        };
                        ariaDesc = `${(myClass ? 1 : 0) + busyFriends.length} in class`;
                      }
                    } else {
                      const fClass = getClassForPeriod(
                        activeFriend.classes,
                        day,
                        p,
                      );
                      const fColor = activeFriend.color || FRIEND_COLORS[0];
                      if (myClass && !fClass) {
                        cellClass = "is-booked-user";
                        ariaDesc = `You: ${myClass.code}`;
                      } else if (!myClass && fClass) {
                        cellClass = "is-booked-friend";
                        customStyle = { backgroundColor: fColor.hex };
                        ariaDesc = `${activeFriend.name}: ${fClass.code}`;
                      } else if (myClass && fClass) {
                        cellClass = "is-booked-both";
                        customStyle = {
                          background: `linear-gradient(135deg, var(--accent) 50%, ${fColor.hex} 50%)`,
                        };
                        ariaDesc = "Both have classes";
                      } else {
                        ariaDesc = "Both free!";
                      }
                    }

                    return (
                      <Fragment key={p.id}>
                        <button
                          type="button"
                          className={`friend-slot-box ${cellClass}`}
                          style={customStyle}
                          aria-label={`${day} ${p.label} (${p.start}–${p.end}): ${ariaDesc}`}
                          onClick={() => handleCellClick(day, p)}
                        />
                        {p.id === 6 ? (
                          <span
                            className="friend-lunch-divider"
                            aria-hidden="true"
                            title="Lunch break (13:20–14:00)"
                          />
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Card 4+: Dedicated Individual Friend Cards */}
      {friends.map((f) => {
        const color = f.color || FRIEND_COLORS[0];
        return (
          <section key={f.id} className="friend-card-section friend-individual-card">
            <div className="friend-individual-header">
              <span
                className="friend-large-avatar"
                style={{ backgroundColor: color.hex }}
              >
                {(f.name || "S").charAt(0).toUpperCase()}
              </span>
              <div className="friend-individual-meta">
                <h3 className="friend-individual-name">{f.name || "Student"}</h3>
                <span className="friend-individual-reg">
                  {f.regNo || "Synced Timetable"}
                </span>
              </div>
            </div>

            <div className="friend-grid-matrix-box">
              <div className="friend-matrix-grid">
                <MatrixTimeHeader />
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="friend-matrix-row">
                    <span className="friend-day-tag">{DAY_SHORT[day] || day}</span>
                    {PERIODS.map((p) => {
                      const item = getClassForPeriod(f.classes, day, p);
                      return (
                        <Fragment key={p.id}>
                          <button
                            type="button"
                            className={`friend-slot-box ${item ? "is-booked-friend" : "is-empty"}`}
                            style={item ? { backgroundColor: color.hex } : {}}
                            aria-label={`${day} ${p.label} (${p.start}–${p.end}): ${item ? item.code || item.title : "Free"}`}
                            onClick={() => handleCellClick(day, p, f)}
                          />
                          {p.id === 6 ? (
                            <span
                              className="friend-lunch-divider"
                              aria-hidden="true"
                              title="Lunch break (13:20–14:00)"
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* 6. Period Detail Bottom Sheet */}
      {selectedCell ? (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCell(null);
          }}
        >
          <div className="friend-period-sheet" role="dialog" aria-modal="true">
            <div className="friend-sheet-handle" />
            <div className="friend-sheet-header">
              <div>
                <span className="friend-sheet-day">
                  {selectedCell.day} · {selectedCell.period.label}
                </span>
                <h3 className="friend-sheet-time">
                  {selectedCell.period.start} – {selectedCell.period.end}
                </h3>
              </div>
              <button
                type="button"
                className="friend-sheet-close"
                onClick={() => setSelectedCell(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="friend-sheet-comparison-grid">
              {/* My schedule block */}
              <div className="friend-sheet-block user-side">
                <div className="friend-block-label">
                  <span className="friend-dot user-dot" />
                  <strong>My Class ({studentName})</strong>
                </div>
                {selectedCell.myClass ? (
                  <div className="friend-block-course">
                    <span className="friend-block-title">
                      {selectedCell.myClass.title || selectedCell.myClass.code}
                    </span>
                    <div className="friend-block-details">
                      <span className="friend-detail-pill">
                        {selectedCell.myClass.code}
                      </span>
                      {selectedCell.myClass.slot ? (
                        <span className="friend-detail-pill">
                          Slot {selectedCell.myClass.slot}
                        </span>
                      ) : null}
                      {selectedCell.myClass.venue ? (
                        <span className="friend-detail-pill venue">
                          <MapPin size={11} /> {selectedCell.myClass.venue}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="friend-block-free">
                    <span>✨ Free period (No class)</span>
                  </div>
                )}
              </div>

              {/* Friend's schedule blocks (All Friends or Single) */}
              {selectedCell.mode === "all" && selectedCell.friendEntries ? (
                selectedCell.friendEntries.map(({ friend, friendClass }) => (
                  <div key={friend.id} className="friend-sheet-block friend-side">
                    <div className="friend-block-label">
                      <span
                        className="friend-dot"
                        style={{
                          backgroundColor: friend.color?.hex || "#f59e0b",
                        }}
                      />
                      <strong>{friend.name}’s Class</strong>
                    </div>
                    {friendClass ? (
                      <div className="friend-block-course">
                        <span className="friend-block-title">
                          {friendClass.title || friendClass.code}
                        </span>
                        <div className="friend-block-details">
                          <span className="friend-detail-pill">
                            {friendClass.code}
                          </span>
                          {friendClass.slot ? (
                            <span className="friend-detail-pill">
                              Slot {friendClass.slot}
                            </span>
                          ) : null}
                          {friendClass.venue ? (
                            <span className="friend-detail-pill venue">
                              <MapPin size={11} /> {friendClass.venue}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="friend-block-free">
                        <span>✨ Free period (No class)</span>
                      </div>
                    )}
                  </div>
                ))
              ) : selectedCell.friend ? (
                <div className="friend-sheet-block friend-side">
                  <div className="friend-block-label">
                    <span
                      className="friend-dot"
                      style={{
                        backgroundColor:
                          selectedCell.friend.color?.hex || "#f59e0b",
                      }}
                    />
                    <strong>
                      {selectedCell.friend.name}’s Class
                    </strong>
                  </div>
                  {selectedCell.friendClass ? (
                    <div className="friend-block-course">
                      <span className="friend-block-title">
                        {selectedCell.friendClass.title ||
                          selectedCell.friendClass.code}
                      </span>
                      <div className="friend-block-details">
                        <span className="friend-detail-pill">
                          {selectedCell.friendClass.code}
                        </span>
                        {selectedCell.friendClass.slot ? (
                          <span className="friend-detail-pill">
                            Slot {selectedCell.friendClass.slot}
                          </span>
                        ) : null}
                        {selectedCell.friendClass.venue ? (
                          <span className="friend-detail-pill venue">
                            <MapPin size={11} /> {selectedCell.friendClass.venue}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="friend-block-free">
                      <span>✨ Free period (No class)</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Verdict Banner */}
            {selectedCell.mode === "all" && selectedCell.friendEntries ? (() => {
              const myC = selectedCell.myClass;
              const freeFriends = selectedCell.friendEntries.filter(
                (e) => !e.friendClass,
              );
              const allFree = !myC && freeFriends.length === selectedCell.friendEntries.length;
              const norm = (v) => (v || "").trim().toUpperCase();
              const sameRoomMatches = myC
                ? selectedCell.friendEntries.filter(
                    ({ friendClass }) =>
                      friendClass &&
                      norm(friendClass.code) === norm(myC.code) &&
                      norm(friendClass.venue) &&
                      norm(friendClass.venue) === norm(myC.venue),
                  )
                : [];
              const verdictClass = allFree
                ? "both-free"
                : sameRoomMatches.length
                  ? "same-class"
                  : "busy";

              return (
                <div className={`friend-sheet-verdict ${verdictClass}`}>
                  {allFree ? (
                    <span>🎉 Everyone is free during this period!</span>
                  ) : sameRoomMatches.length ? (
                    <span>
                      👥 You &{" "}
                      {sameRoomMatches.map((m) => m.friend.name).join(", ")}{" "}
                      have this class together ({myC.venue})!
                    </span>
                  ) : !myC && freeFriends.length > 0 ? (
                    <span>
                      You &{" "}
                      {freeFriends.map((m) => m.friend.name).join(", ")}{" "}
                      are free right now.
                    </span>
                  ) : freeFriends.length > 0 ? (
                    <span>
                      {freeFriends.map((m) => m.friend.name).join(", ")}{" "}
                      {freeFriends.length === 1 ? "is" : "are"} free.
                    </span>
                  ) : (
                    <span>Everyone has a class during this period.</span>
                  )}
                </div>
              );
            })() : selectedCell.friend ? (() => {
              const norm = (v) => (v || "").trim().toUpperCase();
              const myC = selectedCell.myClass;
              const fC = selectedCell.friendClass;
              const sameCourse = myC && fC && norm(myC.code) === norm(fC.code);
              const myVenue = norm(myC?.venue);
              const fVenue = norm(fC?.venue);
              const sameClassRoom = Boolean(
                sameCourse && myVenue && fVenue && myVenue === fVenue,
              );
              const diffClassRoomSameCourse = Boolean(sameCourse && !sameClassRoom);

              let verdictClass = "busy";
              if (!myC && !fC) verdictClass = "both-free";
              else if (sameClassRoom) verdictClass = "same-class";

              return (
                <div className={`friend-sheet-verdict ${verdictClass}`}>
                  {!myC && !fC ? (
                    <span>🎉 Both of you are free during this period!</span>
                  ) : sameClassRoom ? (
                    <span>
                      👥 You both have this class together ({myC.venue})!
                    </span>
                  ) : diffClassRoomSameCourse ? (
                    <span>
                      {myVenue && fVenue
                        ? `Same course (${myC.code}), but different classes (${myC.venue} vs ${fC.venue}).`
                        : `Same course (${myC.code}); room details unavailable to confirm if together.`}
                    </span>
                  ) : !myC && fC ? (
                    <span>
                      You are free while {selectedCell.friend.name} has {fC.code}.
                    </span>
                  ) : myC && !fC ? (
                    <span>
                      You have {myC.code} while {selectedCell.friend.name} is free.
                    </span>
                  ) : (
                    <span>Both of you have different classes scheduled.</span>
                  )}
                </div>
              );
            })() : null}
          </div>
        </div>
      ) : null}

      {/* 7. Modal: My QR Code */}
      {showQrModal ? (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQrModal(false);
          }}
        >
          <div className="friend-modal-card" role="dialog" aria-modal="true">
            <button
              type="button"
              className="friend-modal-close"
              onClick={() => setShowQrModal(false)}
            >
              <X size={20} />
            </button>
            <h2 className="friend-modal-title">My Timetable QR</h2>
            <p className="friend-modal-subtitle">
              {studentName} {regNo ? `· ${regNo}` : ""} ({myClasses.length} classes)
            </p>

            {myClasses.length > 0 ? (
              <>
                <div className="friend-qr-canvas-box">
                  <canvas ref={qrCanvasRef} className="friend-qr-canvas" />
                </div>

                <p className="friend-qr-instructions">
                  Have your friend scan this QR code with VITopia to instantly compare
                  schedules and identify free periods together!
                </p>

                <div className="friend-modal-actions">
                  <button
                    type="button"
                    className="friend-modal-btn primary"
                    onClick={handleCopyCode}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? "Copied!" : "Copy Share Code"}</span>
                  </button>
                  <button
                    type="button"
                    className="friend-modal-btn secondary"
                    onClick={handleDownloadQR}
                  >
                    <Download size={16} />
                    <span>Save QR Image</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="friend-status-banner error">
                <AlertCircle size={16} />
                <span>
                  No classes synced yet. Sync your VTOP account from Profile first to
                  generate your timetable QR code.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 8. Modal: Add Friends */}
      {showAddModal ? (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              stopCamera();
              setShowAddModal(false);
            }
          }}
        >
          <div className="friend-modal-card" role="dialog" aria-modal="true">
            <button
              type="button"
              className="friend-modal-close"
              onClick={() => {
                stopCamera();
                setShowAddModal(false);
              }}
            >
              <X size={20} />
            </button>
            <h2 className="friend-modal-title">Add Friend’s Timetable</h2>
            <p className="friend-modal-subtitle">
              Scan or import your friend’s QR code to view their schedule.
            </p>

            <div className="friend-add-tabs">
              <button
                type="button"
                className={`friend-tab-toggle ${addMode === "camera" ? "active" : ""}`}
                onClick={() => {
                  setAddMode("camera");
                  startCamera();
                }}
              >
                <Camera size={15} />
                <span>Camera</span>
              </button>
              <button
                type="button"
                className={`friend-tab-toggle ${addMode === "upload" ? "active" : ""}`}
                onClick={() => {
                  stopCamera();
                  setAddMode("upload");
                }}
              >
                <Upload size={15} />
                <span>Upload</span>
              </button>
              <button
                type="button"
                className={`friend-tab-toggle ${addMode === "paste" ? "active" : ""}`}
                onClick={() => {
                  stopCamera();
                  setAddMode("paste");
                }}
              >
                <Copy size={15} />
                <span>Paste Code</span>
              </button>
            </div>

            {statusAlert ? (
              <div className={`friend-status-banner ${statusAlert.type}`}>
                <AlertCircle size={15} />
                <span>{statusAlert.text}</span>
              </div>
            ) : null}

            {/* Mode: Camera */}
            {addMode === "camera" ? (
              <div className="friend-camera-container">
                <video
                  ref={videoRef}
                  className="friend-video-preview"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={scanCanvasRef} style={{ display: "none" }} />
                <div className="friend-camera-overlay">
                  <div className="friend-scan-frame" />
                </div>
                {!cameraActive ? (
                  <button
                    type="button"
                    className="friend-start-cam-btn"
                    onClick={startCamera}
                  >
                    <Camera size={16} />
                    <span>Start Scanner</span>
                  </button>
                ) : (
                  <span className="friend-scan-live-text">
                    Align QR code within the frame to scan
                  </span>
                )}
              </div>
            ) : null}

            {/* Mode: Upload */}
            {addMode === "upload" ? (
              <div className="friend-upload-container">
                <label className="friend-dropzone">
                  <Upload size={32} />
                  <span>Tap to choose QR screenshot from gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            ) : null}

            {/* Mode: Paste */}
            {addMode === "paste" ? (
              <div className="friend-paste-container">
                <textarea
                  className="friend-paste-input"
                  rows={4}
                  placeholder="Paste your friend's vtopia:tt:... code here"
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                />
                <button
                  type="button"
                  className="friend-modal-btn primary full"
                  disabled={!pasteInput.trim()}
                  onClick={() => handleImportCode(pasteInput)}
                >
                  <UserPlus size={16} />
                  <span>Import Schedule</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
