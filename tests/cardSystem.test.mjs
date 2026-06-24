import test from "node:test";
import assert from "node:assert/strict";

import {
  getCardGridConfig,
  getScaledCardStart,
  getScaledCardSpan
} from "../src/cardSystem.js";

test("getCardGridConfig maps measured gallery widths to production breakpoints", () => {
  assert.deepEqual(getCardGridConfig(1310), {
    mode: "desktop",
    columns: 12,
    gap: 16,
    offsetScale: 0.34,
    searchOffset: 12
  });

  assert.deepEqual(getCardGridConfig(927), {
    mode: "tablet",
    columns: 6,
    gap: 14,
    offsetScale: 0,
    searchOffset: 0
  });

  assert.deepEqual(getCardGridConfig(343), {
    mode: "mobile",
    columns: 1,
    gap: 12,
    offsetScale: 0,
    searchOffset: 0
  });
});

test("getScaledCardSpan limits cards to feature, standard, and compact rules", () => {
  assert.equal(getScaledCardSpan(5, getCardGridConfig(1310), 0, "feature"), 5);
  assert.equal(getScaledCardSpan(3, getCardGridConfig(927), 4, "standard"), 3);
  assert.equal(getScaledCardSpan(2, getCardGridConfig(927), 5, "compact"), 3);
  assert.equal(getScaledCardSpan(4, getCardGridConfig(927), 0, "feature"), 3);
  assert.equal(getScaledCardSpan(3, getCardGridConfig(343), 4, "standard"), 1);
  assert.equal(getScaledCardSpan(2, getCardGridConfig(343), 9, "compact"), 1);
});

test("getScaledCardStart only applies editorial starts on desktop", () => {
  const tablet = getCardGridConfig(927);
  assert.equal(getScaledCardStart(4, 2, 3, tablet), null);
  assert.equal(getScaledCardStart(4, 2, 2, getCardGridConfig(343)), null);
  assert.equal(getScaledCardStart(9, 3, 3, getCardGridConfig(1310)), 9);
});
