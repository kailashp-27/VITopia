// Theme definitions matching VITopia custom styling
export const THEMES = [
  // --- Light Themes (4) ---
  {
    id: "matte-ivory",
    name: "Matte Ivory",
    group: "light",
    bg: "#fbfaf6",
    surface: "#ffffff",
    surfaceAlt: "#f4f2ea",
    line: "#e5e1d3",
    text: "#1c1917",
    muted: "#78716c",
    accent: "#6366f1",
    accentHover: "#4f46e5",
    onAccent: "#ffffff",
    amber: "#d97706",
    previewDots: ["#6366f1", "#1c1917"],
  },
  {
    id: "fogstone",
    name: "Fogstone",
    group: "light",
    bg: "#f3f4f6",
    surface: "#ffffff",
    surfaceAlt: "#e5e7eb",
    line: "#d1d5db",
    text: "#111827",
    muted: "#6b7280",
    accent: "#4b6b94",
    accentHover: "#3b5577",
    onAccent: "#ffffff",
    amber: "#d97706",
    previewDots: ["#4b6b94", "#111827"],
  },
  {
    id: "slate-mist",
    name: "Slate Mist",
    group: "light",
    bg: "#f8fafc",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    line: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    onAccent: "#ffffff",
    amber: "#d97706",
    previewDots: ["#2563eb", "#0f172a"],
  },
  {
    id: "matte-copper-light",
    name: "Matte Copper Light",
    group: "light",
    bg: "#fdfbf7",
    surface: "#ffffff",
    surfaceAlt: "#f7f1e6",
    line: "#ebdcc9",
    text: "#291e17",
    muted: "#877464",
    accent: "#c25e2e",
    accentHover: "#a6491e",
    onAccent: "#ffffff",
    amber: "#d97706",
    previewDots: ["#c25e2e", "#291e17"],
  },

  // --- Dark Themes (4) ---
  {
    id: "amoled-black",
    name: "AMOLED Black",
    group: "dark",
    bg: "#000000",
    surface: "#0d0d0d",
    surfaceAlt: "#161616",
    line: "#262626",
    text: "#f5f5f5",
    muted: "#888888",
    accent: "#a855f7",
    accentHover: "#9333ea",
    onAccent: "#ffffff",
    amber: "#eabd9a",
    previewDots: ["#a855f7", "#ffffff"],
  },
  {
    id: "velvet-noir",
    name: "Velvet Noir",
    group: "dark",
    bg: "#130f1a",
    surface: "#1c1527",
    surfaceAlt: "#241b33",
    line: "#392c46",
    text: "#ede9fe",
    muted: "#a99bb9",
    accent: "#8b5cf6",
    accentHover: "#7c3aed",
    onAccent: "#ffffff",
    amber: "#eabd9a",
    previewDots: ["#8b5cf6", "#ede9fe"],
  },
  {
    id: "midnight-azure",
    name: "Midnight Azure",
    group: "dark",
    bg: "#0b1320",
    surface: "#111d31",
    surfaceAlt: "#17263f",
    line: "#22385c",
    text: "#e2e8f0",
    muted: "#7c93b3",
    accent: "#38bdf8",
    accentHover: "#0ea5e9",
    onAccent: "#0b1320",
    amber: "#fcd34d",
    previewDots: ["#38bdf8", "#e2e8f0"],
  },
  {
    id: "emerald-night",
    name: "Emerald Night",
    group: "dark",
    bg: "#091612",
    surface: "#0f241e",
    surfaceAlt: "#16332b",
    line: "#204a3e",
    text: "#e6f7f2",
    muted: "#7dbfae",
    accent: "#10b981",
    accentHover: "#059669",
    onAccent: "#ffffff",
    amber: "#6ee7b7",
    previewDots: ["#10b981", "#e6f7f2"],
  },
];

export function getSavedThemeId() {
  try {
    return localStorage.getItem("vtopia_theme") || "amoled-black";
  } catch {
    return "amoled-black";
  }
}

export function applyTheme(themeId) {
  const theme =
    THEMES.find((t) => t.id === themeId) ||
    THEMES.find((t) => t.id === "amoled-black") ||
    THEMES[0];
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--surface-alt", theme.surfaceAlt);
  root.style.setProperty("--line", theme.line);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-hover", theme.accentHover);
  root.style.setProperty("--on-accent", theme.onAccent || "#ffffff");
  root.style.setProperty("--amber", theme.amber);
  const isLight = theme.group === "light";
  root.style.setProperty("--status-good", isLight ? "#15803d" : "#4ade80");
  root.style.setProperty(
    "--status-good-bg",
    isLight ? "rgba(21, 128, 61, 0.12)" : "rgba(74, 222, 128, 0.14)",
  );
  root.style.setProperty("--status-danger", isLight ? "#dc2626" : "#f87171");
  root.style.setProperty(
    "--status-danger-bg",
    isLight ? "rgba(220, 38, 38, 0.12)" : "rgba(248, 113, 113, 0.14)",
  );
  root.style.setProperty("color-scheme", theme.group);

  // Synonyms and legacy variable aliases so all components update
  root.style.setProperty("--app-bg", theme.bg);
  root.style.setProperty("--panel", theme.surface);
  root.style.setProperty("--panel-alt", theme.surfaceAlt);
  root.style.setProperty("--border", theme.line);
  root.style.setProperty("--soft", theme.accent);
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.bg);
  }
  try {
    localStorage.setItem("vtopia_theme", theme.id);
  } catch {}
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function" &&
      typeof CustomEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent("vtopia-theme-change", { detail: theme }),
      );
    }
  } catch {}
  return theme;
}
