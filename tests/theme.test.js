import test from "node:test";
import assert from "node:assert/strict";
import { THEMES, applyTheme, getSavedThemeId } from "../src/theme.js";

test("theme catalog contains exactly 4 light themes and 4 dark themes defaulting to AMOLED Black", () => {
  const light = THEMES.filter((t) => t.group === "light");
  const dark = THEMES.filter((t) => t.group === "dark");
  assert.equal(light.length, 4);
  assert.equal(dark.length, 4);
  assert.ok(dark.some((t) => t.id === "amoled-black"));
  assert.equal(getSavedThemeId(), "amoled-black");
  for (const theme of THEMES) {
    assert.ok(theme.id && theme.name && theme.accent && theme.onAccent);
  }
});

test("applyTheme sets light/dark status tokens and falls back to amoled-black", () => {
  const vars = new Map();
  let attr = "";
  const originalDoc = globalThis.document;
  globalThis.document = {
    documentElement: {
      setAttribute(name, value) {
        if (name === "data-theme") attr = value;
      },
      style: {
        setProperty(k, v) {
          vars.set(k, v);
        },
      },
    },
    querySelector() {
      return null;
    },
  };
  try {
    const appliedLight = applyTheme("matte-ivory");
    assert.equal(appliedLight.id, "matte-ivory");
    assert.equal(attr, "matte-ivory");
    assert.equal(vars.get("--status-good"), "#15803d");
    assert.equal(vars.get("--status-danger"), "#dc2626");
    assert.equal(vars.get("color-scheme"), "light");

    const appliedAzure = applyTheme("midnight-azure");
    assert.equal(appliedAzure.id, "midnight-azure");
    assert.equal(vars.get("--on-accent"), "#0b1320");
    assert.equal(vars.get("--status-good"), "#4ade80");
    assert.equal(vars.get("color-scheme"), "dark");

    const fallback = applyTheme("non-existent-theme");
    assert.equal(fallback.id, "amoled-black");
  } finally {
    globalThis.document = originalDoc;
  }
});
