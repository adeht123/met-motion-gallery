import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getCardRevealDelay,
  getDetailEntryKeyframes,
  getDetailNavKeyframes
} from "../src/motionSystem.js";

test("getCardRevealDelay keeps feature cards first and caps the gallery reveal", () => {
  assert.equal(getCardRevealDelay(0, "feature", false), 0);
  assert.equal(getCardRevealDelay(1, "standard", false), 36);
  assert.equal(getCardRevealDelay(2, "compact", false), 72);
  assert.equal(getCardRevealDelay(20, "compact", false), 180);
  assert.equal(getCardRevealDelay(4, "standard", true), 0);
});

test("getDetailEntryKeyframes starts detail media from the selected card media rect", () => {
  const keyframes = getDetailEntryKeyframes(
    { left: 40, top: 120, width: 240, height: 320 },
    { left: 220, top: 80, width: 480, height: 640 }
  );

  assert.equal(keyframes.length, 2);
  assert.equal(keyframes[0].opacity, 0.86);
  assert.match(keyframes[0].transform, /translate\(-300px, -120px\)/);
  assert.match(keyframes[0].transform, /scale\(0\.5, 0\.5\)/);
  assert.equal(keyframes[1].transform, "translate(0px, 0px) scale(1, 1)");
});

test("getDetailNavKeyframes gives directional next and previous artwork transitions", () => {
  const next = getDetailNavKeyframes("next");
  const previous = getDetailNavKeyframes("prev");

  assert.equal(next.exit[1].transform, "translateX(-8px)");
  assert.equal(next.enter[0].transform, "translateX(8px)");
  assert.equal(previous.exit[1].transform, "translateX(8px)");
  assert.equal(previous.enter[0].transform, "translateX(-8px)");
});

test("styles expose museum motion contracts for reveal, image load, detail swap, and search stagger", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /--motion-card-reveal-y:\s*14px/);
  assert.match(css, /\.art-cell\.is-revealing\s+\.art-card/);
  assert.match(css, /filter:\s*blur\(6px\)\s+saturate\(0\.82\)/);
  assert.match(css, /\.detail-media\.is-swapping/);
  assert.match(css, /\.search-dialog\.is-open\s+\.search-field/);
  assert.match(css, /\.load-sentinel\s*{[\s\S]*overflow-anchor:\s*none/);
});

test("card save control uses icon-only plus and check states", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const setSaveButtonStart = source.indexOf("function setSaveButtonState");
  const setSaveButtonEnd = source.indexOf("function hideStatePanel", setSaveButtonStart);
  const setSaveButtonSource = source.slice(setSaveButtonStart, setSaveButtonEnd);
  const cardSaveBranch = setSaveButtonSource.slice(0, setSaveButtonSource.indexOf("    return;"));

  assert.match(setSaveButtonSource, /button\.classList\.add\("art-card__save--icon"\)/);
  assert.match(setSaveButtonSource, /button\.setAttribute\("aria-label", pressed \? "저장된 작품\. 저장 해제 \/ Remove from saved" : "작품 저장 \/ Save work"\)/);
  assert.match(setSaveButtonSource, /button\.setAttribute\("title", pressed \? "Saved" : "Save"\)/);
  assert.match(setSaveButtonSource, /button\.textContent = ""/);
  assert.doesNotMatch(cardSaveBranch, /button\.textContent = pressed \? "Saved" : "Save"/);
});

test("styles expose saved pin morph and confirmation underline", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.art-card__save--icon::before/);
  assert.match(css, /\.art-card__save--icon::after/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*content:\s*""/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*background:\s*linear-gradient\(currentColor,\s*currentColor\)\s+center \/ 1px 13px no-repeat,[\s\S]*linear-gradient\(currentColor,\s*currentColor\)\s+center \/ 13px 1px no-repeat/);
  assert.doesNotMatch(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*content:\s*"\+"/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="true"\]::after\s*{[\s\S]*content:\s*"\\2713"/);
  assert.match(css, /\.art-card\.is-saved::after\s*{[\s\S]*transform:\s*translateX\(-50%\)\s+scaleX\(1\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.art-card__save--icon::before/);
});

test("styles expose sketch-like hover and saved glow layers", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.art-card:hover,\s*[\s\S]*\.art-card:focus-visible\s*{[\s\S]*0 18px 38px rgba\(243, 240, 231, 0\.22\)/);
  assert.match(css, /\.art-card\.is-saved::after\s*{[\s\S]*box-shadow:\s*0 0 10px rgba\(243, 240, 231, 0\.46\)/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="true"\]::before\s*{[\s\S]*0 0 0 4px rgba\(247, 245, 238, 0\.72\)/);
});

test("card images attach load handlers before assigning src for cached image reveal", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const createCardStart = source.indexOf("function createCard");
  const createCardEnd = source.indexOf("function revealCells", createCardStart);
  const createCardSource = source.slice(createCardStart, createCardEnd);
  const loadListenerIndex = createCardSource.indexOf('image.addEventListener("load"');
  const srcAssignmentIndex = createCardSource.indexOf("image.src =");

  assert.ok(loadListenerIndex > -1);
  assert.ok(srcAssignmentIndex > -1);
  assert.ok(loadListenerIndex < srcAssignmentIndex);
});
