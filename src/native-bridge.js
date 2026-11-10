import { Capacitor, registerPlugin } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { THEMES, getSavedThemeId } from "./theme.js";
import { buildWidgetSnapshot } from "./widget-snapshot.js";

const VtopiaWidget = registerPlugin("VtopiaWidget");

export function isCapacitorNative() {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function syncNativeStatusBar(theme) {
  if (!isCapacitorNative() || !theme) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: theme.bg || "#000000" });
    await StatusBar.setStyle({
      style: theme.group === "light" ? Style.Light : Style.Dark,
    });
  } catch {}
}

export async function pushWidgetSnapshot(data, demoMode = false, themeId) {
  if (!isCapacitorNative()) return;
  try {
    const snapshot = buildWidgetSnapshot({ data, demoMode, themeId });
    await VtopiaWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) });
  } catch {}
}

export async function clearWidgetSnapshot(themeId) {
  if (!isCapacitorNative()) return;
  try {
    const snapshot = buildWidgetSnapshot({ data: null, demoMode: false, themeId });
    await VtopiaWidget.updateSnapshot({ snapshot: JSON.stringify(snapshot) });
  } catch {}
}

export async function pinNativeWidget(kind) {
  if (!isCapacitorNative()) return { requested: false, supported: false };
  return VtopiaWidget.pinWidget({ kind });
}

export function initNativeBridge({ onNavigate, onThemeChange } = {}) {
  if (!isCapacitorNative()) return () => {};

  const savedId = getSavedThemeId();
  const initialTheme =
    THEMES.find((t) => t.id === savedId) ||
    THEMES.find((t) => t.id === "amoled-black") ||
    THEMES[0];
  void syncNativeStatusBar(initialTheme);

  const handleThemeEvent = (event) => {
    const theme = event?.detail;
    if (!theme) return;
    void syncNativeStatusBar(theme);
    onThemeChange?.(theme);
  };
  window.addEventListener("vtopia-theme-change", handleThemeEvent);

  let listenerHandle = null;
  let active = true;

  VtopiaWidget.addListener("widgetNavigate", (payload) => {
    if (active && payload?.target) {
      onNavigate?.(payload.target);
    }
  })
    .then((handle) => {
      if (active) listenerHandle = handle;
      else handle?.remove?.();
    })
    .catch(() => {});

  VtopiaWidget.getLaunchTarget()
    .then((res) => {
      if (active && res?.target) {
        onNavigate?.(res.target);
      }
    })
    .catch(() => {});

  return () => {
    active = false;
    window.removeEventListener("vtopia-theme-change", handleThemeEvent);
    listenerHandle?.remove?.();
  };
}
