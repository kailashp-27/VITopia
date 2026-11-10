export const TOP_LEVEL_TABS = [
  "overview",
  "attendance",
  "calendar",
  "marks",
  "profile",
];

export const FALLBACK_PARENT_SCREEN = {
  "widget-customization": "settings",
  "theme-customization": "settings",
  settings: "profile",
  courses: "profile",
  exams: "profile",
  simulator: "profile",
  "cgpa-calculator": "profile",
  "share-timetable": "profile",
  "hostel-leave": "profile",
  details: "profile",
  proctor: "profile",
  attendance: "overview",
  calendar: "overview",
  marks: "overview",
  profile: "overview",
  overview: null,
};

export function pushHistoryScreen(currentScreen, nextScreen, historyStack = []) {
  if (!nextScreen || nextScreen === currentScreen) {
    return historyStack;
  }
  if (historyStack.at(-1) === currentScreen) {
    return historyStack;
  }
  return [...historyStack, currentScreen];
}

export function popOrFallbackBackScreen(currentScreen, historyStack = []) {
  if (historyStack.length > 0) {
    const nextScreen = historyStack.at(-1);
    const nextStack = historyStack.slice(0, -1);
    if (nextScreen && nextScreen !== currentScreen) {
      return { handled: true, nextScreen, nextStack };
    }
    if (nextStack.length > 0) {
      return popOrFallbackBackScreen(currentScreen, nextStack);
    }
  }
  const fallback = FALLBACK_PARENT_SCREEN[currentScreen];
  if (fallback) {
    return { handled: true, nextScreen: fallback, nextStack: [] };
  }
  return { handled: false, nextScreen: currentScreen, nextStack: [] };
}

const overlayStack = [];

export function registerBackOverlay(onClose) {
  if (typeof onClose !== "function") return () => {};
  const entry = { onClose };
  overlayStack.push(entry);
  return () => {
    const index = overlayStack.lastIndexOf(entry);
    if (index !== -1) {
      overlayStack.splice(index, 1);
    }
  };
}

export function closeTopBackOverlay() {
  const top = overlayStack.at(-1);
  if (!top) return false;
  top.onClose();
  return true;
}

export function clearBackOverlays() {
  overlayStack.length = 0;
}
