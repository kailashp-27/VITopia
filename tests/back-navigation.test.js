import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_PARENT_SCREEN,
  TOP_LEVEL_TABS,
  pushHistoryScreen,
  popOrFallbackBackScreen,
  registerBackOverlay,
  closeTopBackOverlay,
  clearBackOverlays,
} from "../src/back-navigation.js";

test("pushHistoryScreen avoids duplicate consecutive screens", () => {
  const first = pushHistoryScreen("profile", "proctor", []);
  assert.deepEqual(first, ["profile"]);
  const duplicate = pushHistoryScreen("profile", "proctor", first);
  assert.deepEqual(duplicate, ["profile"]);
  const same = pushHistoryScreen("proctor", "proctor", first);
  assert.deepEqual(same, ["profile"]);
});

test("step-by-step back navigation unwinds subsection stack then exits on overview", () => {
  // Profile -> Student details -> Proctor info
  let screen = "profile";
  let stack = [];
  stack = pushHistoryScreen(screen, "details", stack);
  screen = "details";
  stack = pushHistoryScreen(screen, "proctor", stack);
  screen = "proctor";

  let step = popOrFallbackBackScreen(screen, stack);
  assert.deepEqual(step, {
    handled: true,
    nextScreen: "details",
    nextStack: ["profile"],
  });

  step = popOrFallbackBackScreen(step.nextScreen, step.nextStack);
  assert.deepEqual(step, {
    handled: true,
    nextScreen: "profile",
    nextStack: [],
  });

  step = popOrFallbackBackScreen(step.nextScreen, step.nextStack);
  assert.deepEqual(step, {
    handled: true,
    nextScreen: "overview",
    nextStack: [],
  });

  step = popOrFallbackBackScreen(step.nextScreen, step.nextStack);
  assert.deepEqual(step, {
    handled: false,
    nextScreen: "overview",
    nextStack: [],
  });
});

test("fallback hierarchy supports direct deep links like settings subpages and tabs", () => {
  assert.equal(FALLBACK_PARENT_SCREEN["widget-customization"], "settings");
  assert.equal(FALLBACK_PARENT_SCREEN["theme-customization"], "settings");
  assert.equal(FALLBACK_PARENT_SCREEN["proctor"], "profile");
  assert.equal(FALLBACK_PARENT_SCREEN["overview"], null);

  for (const tab of TOP_LEVEL_TABS) {
    const res = popOrFallbackBackScreen(tab, []);
    if (tab === "overview") {
      assert.equal(res.handled, false);
    } else {
      assert.equal(res.handled, true);
      assert.equal(res.nextScreen, "overview");
    }
  }
});

test("overlay back stack closes top-most modal/sheet in LIFO order", () => {
  clearBackOverlays();
  const closed = [];
  const offFirst = registerBackOverlay(() => closed.push("sheet"));
  const offSecond = registerBackOverlay(() => closed.push("modal"));

  assert.equal(closeTopBackOverlay(), true);
  assert.deepEqual(closed, ["modal"]);
  offSecond();

  assert.equal(closeTopBackOverlay(), true);
  assert.deepEqual(closed, ["modal", "sheet"]);
  offFirst();

  assert.equal(closeTopBackOverlay(), false);
});
