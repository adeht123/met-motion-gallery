import test from "node:test";
import assert from "node:assert/strict";

import {
  createDiscoveryDiversityState,
  getDiscoverFamilyKey,
  normalizeDiscoveryKey,
  reviewDiscoverCandidate
} from "../src/discoveryDiversity.js";

function work(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? "Worker Shabti of Nauny",
    objectName: overrides.objectName ?? "Shabti, worker, Nauny",
    department: overrides.department ?? "Egyptian Art",
    classification: overrides.classification ?? "",
    culture: overrides.culture ?? "Egypt",
    hasImage: true,
    ...overrides
  };
}

test("normalizeDiscoveryKey removes punctuation, case, and parenthetical noise", () => {
  assert.equal(
    normalizeDiscoveryKey("Marble statue of a kouros (youth)"),
    "marble statue of a kouros"
  );
  assert.equal(normalizeDiscoveryKey("  Worker--Shabti, of Nauny  "), "worker shabti of nauny");
});

test("getDiscoverFamilyKey groups different object IDs from the same series", () => {
  assert.equal(
    getDiscoverFamilyKey(work({ id: 625751, accessionNumber: "30.3.26.83" })),
    getDiscoverFamilyKey(work({ id: 625741, accessionNumber: "30.3.26.73" }))
  );
});

test("reviewDiscoverCandidate allows only one exact family across Discover", () => {
  const state = createDiscoveryDiversityState();
  const batch = createDiscoveryDiversityState();
  const accepted = [];

  for (let index = 0; index < 20; index += 1) {
    const candidate = work({ id: 625730 + index });
    const review = reviewDiscoverCandidate(candidate, { globalState: state, batchState: batch });
    if (review.accepted) accepted.push(candidate);
  }

  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, 625730);
  assert.equal(state.seenFamilies.size, 1);
});

test("reviewDiscoverCandidate marks rejected IDs as visited so overlapping lanes do not refetch them", () => {
  const state = createDiscoveryDiversityState();
  const batch = createDiscoveryDiversityState();

  assert.equal(reviewDiscoverCandidate(work({ id: 10 }), { globalState: state, batchState: batch }).accepted, true);
  assert.equal(reviewDiscoverCandidate(work({ id: 11 }), { globalState: state, batchState: batch }).accepted, false);

  assert.equal(state.seenIds.has(10), true);
  assert.equal(state.visitedIds.has(10), true);
  assert.equal(state.visitedIds.has(11), true);
});

test("generic titles are capped to one per batch and two globally", () => {
  const state = createDiscoveryDiversityState();

  const firstBatch = createDiscoveryDiversityState();
  assert.equal(reviewDiscoverCandidate(work({
    id: 1,
    title: "Bowl",
    objectName: "Bowl",
    department: "Asian Art",
    classification: "Ceramics"
  }), { globalState: state, batchState: firstBatch }).accepted, true);
  assert.equal(reviewDiscoverCandidate(work({
    id: 2,
    title: "Bowl",
    objectName: "Bowl",
    department: "Greek and Roman Art",
    classification: "Ceramics"
  }), { globalState: state, batchState: firstBatch }).accepted, false);

  const secondBatch = createDiscoveryDiversityState();
  assert.equal(reviewDiscoverCandidate(work({
    id: 3,
    title: "Bowl",
    objectName: "Bowl",
    department: "European Sculpture and Decorative Arts",
    classification: "Ceramics"
  }), { globalState: state, batchState: secondBatch }).accepted, true);

  const thirdBatch = createDiscoveryDiversityState();
  assert.equal(reviewDiscoverCandidate(work({
    id: 4,
    title: "Bowl",
    objectName: "Bowl",
    department: "The American Wing",
    classification: "Ceramics"
  }), { globalState: state, batchState: thirdBatch }).accepted, false);
});

test("batch diversity limits the same department and classification", () => {
  const state = createDiscoveryDiversityState();
  const batch = createDiscoveryDiversityState();

  assert.equal(reviewDiscoverCandidate(work({
    id: 1,
    title: "Moonlit Harbor",
    objectName: "Painting",
    department: "European Paintings",
    classification: "Paintings"
  }), { globalState: state, batchState: batch }).accepted, true);
  assert.equal(reviewDiscoverCandidate(work({
    id: 2,
    title: "Dawn Harbor",
    objectName: "Painting",
    department: "European Paintings",
    classification: "Paintings"
  }), { globalState: state, batchState: batch }).accepted, true);
  assert.equal(reviewDiscoverCandidate(work({
    id: 3,
    title: "Storm Harbor",
    objectName: "Painting",
    department: "European Paintings",
    classification: "Paintings"
  }), { globalState: state, batchState: batch }).accepted, false);
});
