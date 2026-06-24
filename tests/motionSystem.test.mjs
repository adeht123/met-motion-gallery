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
  assert.equal(getCardRevealDelay(1, "standard", false), 72);
  assert.equal(getCardRevealDelay(2, "compact", false), 144);
  assert.equal(getCardRevealDelay(20, "compact", false), 560);
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

  assert.match(css, /--duration-reveal:\s*720ms/);
  assert.match(css, /--motion-card-reveal-y:\s*10px/);
  assert.match(css, /--motion-card-reveal-scale:\s*0\.992/);
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

test("styles expose saved pin morph without confirmation underline", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.art-card__save--icon::before/);
  assert.match(css, /\.art-card__save--icon::after/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*content:\s*""/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*background:\s*linear-gradient\(currentColor,\s*currentColor\)\s+center \/ 1px 13px no-repeat,[\s\S]*linear-gradient\(currentColor,\s*currentColor\)\s+center \/ 13px 1px no-repeat/);
  assert.doesNotMatch(css, /\.art-card__save--icon\[aria-pressed="false"\]::after\s*{[\s\S]*content:\s*"\+"/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="true"\]::after\s*{[\s\S]*content:\s*"\\2713"/);
  assert.doesNotMatch(css, /\.art-card::after\s*{/);
  assert.doesNotMatch(css, /\.art-card\.is-saved::after\s*{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.art-card__save--icon::before/);
});

test("styles expose hover and focus Apple-style card aura motion", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const reducedMotionCss = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  const cardHoverBlock = css.match(/\.art-card:hover,\s*[\r\n]+\.art-card:focus-visible\s*{[\s\S]*?\n}/)?.[0] ?? "";
  const imageHoverBlock = css.match(/\.art-card:hover \.art-card__media img,\s*[\r\n]+\.art-card:focus-visible \.art-card__media img\s*{[\s\S]*?\n}/)?.[0] ?? "";
  const sharedAuraBlock = css.match(/\.art-cell::before,\s*[\s\S]*\.art-cell::after\s*{[\s\S]*?\n}/)?.[0] ?? "";
  const outerAuraBlock = css.match(/(?:^|\r?\n\r?\n)\.art-cell::before\s*{[\s\S]*?\n}/)?.[0] ?? "";
  const innerAuraBlock = css.match(/(?:^|\r?\n\r?\n)\.art-cell::after\s*{[\s\S]*?\n}/)?.[0] ?? "";

  assert.notEqual(cardHoverBlock, "");
  assert.notEqual(imageHoverBlock, "");
  assert.notEqual(sharedAuraBlock, "");
  assert.notEqual(outerAuraBlock, "");
  assert.notEqual(innerAuraBlock, "");
  assert.match(sharedAuraBlock, /transition:\s*opacity var\(--duration-glow-enter\)/);
  assert.match(outerAuraBlock, /inset:\s*-15px/);
  assert.match(outerAuraBlock, /radial-gradient/);
  assert.match(outerAuraBlock, /filter:\s*blur\(18px\) saturate\(1\.12\)/);
  assert.match(innerAuraBlock, /inset:\s*-8px/);
  assert.match(innerAuraBlock, /radial-gradient/);
  assert.match(innerAuraBlock, /filter:\s*blur\(10px\)/);
  assert.doesNotMatch(outerAuraBlock, /padding:\s*1px|mask|mask-composite/);
  assert.doesNotMatch(innerAuraBlock, /padding:\s*1px|mask|mask-composite/);
  assert.match(css, /\.art-cell:hover::before,\s*[\s\S]*\.art-cell:focus-within::before\s*{[\s\S]*opacity:\s*var\(--motion-glow-aura-opacity\)[\s\S]*animation:\s*cardAuraDrift var\(--duration-glow\)/);
  assert.match(css, /\.art-cell:hover::after,\s*[\s\S]*\.art-cell:focus-within::after\s*{[\s\S]*opacity:\s*var\(--motion-glow-wash-opacity\)[\s\S]*animation:\s*cardAuraDrift var\(--duration-glow\)/);
  assert.match(css, /@keyframes cardAuraDrift[\s\S]*background-position[\s\S]*translate3d\([\s\S]*scale/);
  assert.doesNotMatch(css, /^\.art-card::before\s*{/m);
  assert.doesNotMatch(css, /cardGlowDrift/);
  assert.doesNotMatch(css, /cardEdgeGlowDrift/);
  assert.doesNotMatch(css, /\.art-card:hover::before/);
  assert.doesNotMatch(css, /\.art-card:focus-visible::before/);
  assert.doesNotMatch(cardHoverBlock, /background:\s*var\(--paper-bright\)/);
  assert.doesNotMatch(imageHoverBlock, /brightness|saturate\(0\.96\)|contrast\(1\)/);
  assert.match(css, /--duration-glow:\s*14s/);
  assert.match(css, /--duration-glow-enter:\s*720ms/);
  assert.match(css, /--motion-glow-aura-opacity:\s*0\.22/);
  assert.match(css, /--motion-glow-wash-opacity:\s*0\.1/);
  assert.match(css, /--motion-card-hover-y:\s*-1px/);
  assert.doesNotMatch(css, /--motion-glow-ring-opacity|--motion-glow-frame-outset/);
  assert.doesNotMatch(css, /^\.gallery::before\s*{/m);
  assert.doesNotMatch(css, /^\.gallery::after\s*{/m);
  assert.doesNotMatch(css, /^body::before\s*{/m);
  assert.doesNotMatch(css, /^body::after\s*{/m);
  assert.doesNotMatch(css, /\.gallery-glow-frame/);
  assert.doesNotMatch(css, /conic-gradient/);
  assert.doesNotMatch(css, /mask-composite/);
  assert.match(css, /@media \(hover: none\)[\s\S]*\.art-cell::before,\s*[\s\S]*\.art-cell::after\s*{[\s\S]*display:\s*none/);
  assert.match(reducedMotionCss, /\.art-cell::before,\s*[\s\S]*\.art-cell::after\s*{[\s\S]*animation:\s*none/);
  assert.match(css, /\.art-card__save--icon\[aria-pressed="true"\]::before\s*{[\s\S]*0 0 0 4px rgba\(247, 245, 238, 0\.72\)/);
});

test("gallery glow uses card cell layers without global frame sync", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.doesNotMatch(html, /gallery-glow-frame/);
  assert.doesNotMatch(source, /galleryGlowFrame/);
  assert.doesNotMatch(source, /syncGalleryGlowFrame/);
  assert.doesNotMatch(source, /scheduleGalleryGlowFrameSync/);
  assert.doesNotMatch(source, /is-gallery-glow-active/);
  assert.doesNotMatch(source, /--gallery-glow-left|--gallery-glow-top|--gallery-glow-width|--gallery-glow-height/);
});

test("view bar aligns to the gallery edges and card labels render unboxed icons", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const viewBarBlock = css.match(/^\.view-bar\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const actionsBlock = css.match(/^\.view-bar__actions\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const typeBlock = css.match(/^\.art-card__type\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const iconTypeBlock = css.match(/^\.art-card__type--icon\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const iconBlock = css.match(/^\.art-card__type-icon\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const topLineBlock = css.match(/^\.art-card__topline\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const compactTopLineBlock = css.match(/^\.art-card--compact \.art-card__topline,\s*[\r\n]+\.art-card--small \.art-card__topline\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const compactIconBlock = css.match(/^\.art-card--compact \.art-card__type-icon,\s*[\r\n]+\.art-card--small \.art-card__type-icon\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const saveBlock = [...css.matchAll(/^\.art-card__save\s*{[\s\S]*?\n}/gm)]
    .map((match) => match[0])
    .find((block) => /position:\s*relative/.test(block)) ?? "";
  const topLineIconBlock = css.match(/^\.art-card__topline \.art-card__type--icon\s*{[\s\S]*?\n}/m)?.[0] ?? "";
  const narrowObjectIconBlock = css.match(/^\.art-card__type--icon:is\([\s\S]*?\[data-icon="statuette"\][\s\S]*?\n}/m)?.[0] ?? "";

  assert.notEqual(viewBarBlock, "");
  assert.notEqual(actionsBlock, "");
  assert.notEqual(typeBlock, "");
  assert.notEqual(iconTypeBlock, "");
  assert.notEqual(iconBlock, "");
  assert.notEqual(topLineBlock, "");
  assert.notEqual(compactTopLineBlock, "");
  assert.notEqual(compactIconBlock, "");
  assert.notEqual(saveBlock, "");
  assert.notEqual(topLineIconBlock, "");
  assert.notEqual(narrowObjectIconBlock, "");
  assert.match(viewBarBlock, /display:\s*grid/);
  assert.match(viewBarBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.doesNotMatch(viewBarBlock, /padding-left:\s*clamp/);
  assert.match(actionsBlock, /justify-self:\s*end/);
  assert.match(topLineBlock, /display:\s*flex/);
  assert.match(topLineBlock, /justify-content:\s*flex-start/);
  assert.match(topLineBlock, /align-items:\s*center/);
  assert.match(topLineBlock, /margin-bottom:\s*10px/);
  assert.match(saveBlock, /margin:\s*-12px -10px -12px auto/);
  assert.match(typeBlock, /display:\s*inline-block/);
  assert.match(typeBlock, /max-width:\s*100%/);
  assert.match(typeBlock, /padding:\s*3px 8px 3px 10px/);
  assert.match(typeBlock, /border:\s*1px solid var\(--label-border\)/);
  assert.match(typeBlock, /background:\s*var\(--label-bg\)/);
  assert.match(typeBlock, /border-radius:\s*4px/);
  assert.match(typeBlock, /box-shadow:\s*inset 3px 0 0 var\(--label-accent\)/);
  assert.match(typeBlock, /overflow:\s*hidden/);
  assert.match(typeBlock, /text-overflow:\s*ellipsis/);
  assert.match(typeBlock, /white-space:\s*nowrap/);
  assert.match(iconTypeBlock, /display:\s*inline-flex/);
  assert.match(iconTypeBlock, /width:\s*auto/);
  assert.match(iconTypeBlock, /height:\s*auto/);
  assert.match(iconTypeBlock, /margin-bottom:\s*10px/);
  assert.match(iconTypeBlock, /padding:\s*0/);
  assert.match(iconTypeBlock, /align-items:\s*center/);
  assert.match(iconTypeBlock, /justify-content:\s*center/);
  assert.match(iconTypeBlock, /border:\s*0/);
  assert.match(iconTypeBlock, /border-radius:\s*0/);
  assert.match(iconTypeBlock, /background:\s*transparent/);
  assert.match(iconTypeBlock, /box-shadow:\s*none/);
  assert.match(iconBlock, /width:\s*30px/);
  assert.match(iconBlock, /height:\s*30px/);
  assert.match(iconBlock, /object-fit:\s*contain/);
  assert.match(iconBlock, /display:\s*block/);
  assert.match(iconBlock, /transform:\s*translateY\(var\(--icon-shift-y,\s*0px\)\)\s*scale\(var\(--icon-optical-scale,\s*1\)\)/);
  assert.match(topLineIconBlock, /margin:\s*0/);
  assert.match(topLineIconBlock, /flex:\s*0 0 auto/);
  assert.match(css, /\.art-card--compact \.art-card__type-icon,\s*\.art-card--small \.art-card__type-icon/);
  assert.match(compactIconBlock, /width:\s*28px/);
  assert.match(compactIconBlock, /height:\s*28px/);
  assert.match(compactTopLineBlock, /margin-bottom:\s*10px/);
  assert.match(narrowObjectIconBlock, /--icon-optical-scale:\s*1\.2/);
  assert.match(css, /\.art-card__type--icon:is\([\s\S]*\[data-icon="amulets"\][\s\S]*--icon-optical-scale:\s*1\.16/);
  assert.doesNotMatch(css, /\.art-card__index/);
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="painting"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="paper"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="object"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="textile"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="ceramic"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="metal"]'));
  assert.ok(css.includes('.art-card__type:not(.art-card__type--icon)[data-tone="default"]'));
  assert.match(source, /import\s*{\s*getCardLabelIcon,\s*getCardLabelTone\s*}\s*from "\.\/cardPresentation\.js"/);
  assert.match(source, /const labelIcon = getCardLabelIcon\(work\)/);
  assert.match(source, /const type = createElement\("p",\s*"art-card__type"\)/);
  assert.match(source, /type\.dataset\.tone = getCardLabelTone\(work\)/);
  assert.match(source, /type\.classList\.add\("art-card__type--icon"\)/);
  assert.match(source, /type\.dataset\.icon = labelIcon\.slug/);
  assert.match(source, /createElement\("img",\s*"art-card__type-icon"\)/);
  assert.match(source, /type\.append\(iconImage,\s*createElement\("span",\s*"sr-only",\s*labelText\)\)/);
  assert.match(source, /topLine\.append\(type,\s*saveButton\)/);
  assert.match(source, /header\.append\(topLine,\s*title,\s*facts\)/);
  assert.match(source, /type\.classList\.add\("sr-only"\)/);
  assert.doesNotMatch(source, /createElement\("span",\s*"art-card__index"/);
  assert.doesNotMatch(source, /labelIcon \? null : labelText/);
  assert.doesNotMatch(source, /createElement\("p",\s*"art-card__type",\s*labelText\)/);
  assert.doesNotMatch(source, /createElement\("p",\s*"art-card__type",\s*compactText/);
});

test("cards do not render a visible details footer", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const createCardStart = source.indexOf("function createCard");
  const createCardEnd = source.indexOf("function revealCells", createCardStart);
  const createCardSource = source.slice(createCardStart, createCardEnd);

  assert.doesNotMatch(createCardSource, /createElement\("div",\s*"art-card__footer"\)/);
  assert.doesNotMatch(createCardSource, /createElement\("span",\s*"",\s*"Open details"\)/);
  assert.match(createCardSource, /card\.setAttribute\("aria-label", `\$\{cardTitle\}, \$\{cardArtist\}\. Open details\.`\)/);
  assert.doesNotMatch(css, /\.art-card__footer\s*{/);
  assert.doesNotMatch(css, /--card-footer-pad-y:/);
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
