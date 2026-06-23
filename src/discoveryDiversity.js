const GENERIC_TITLES = new Set([
  "bowl",
  "fragment",
  "vessel",
  "plate",
  "figure",
  "coin",
  "untitled object"
]);

const GENERIC_GLOBAL_LIMIT = 2;
const GENERIC_BATCH_LIMIT = 1;
const GROUP_BATCH_LIMIT = 2;

function increment(map, key) {
  const next = (map.get(key) || 0) + 1;
  map.set(key, next);
  return next;
}

function count(map, key) {
  return map.get(key) || 0;
}

export function normalizeDiscoveryKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createDiscoveryDiversityState(seed = {}) {
  return {
    seenIds: new Set(seed.seenIds || []),
    visitedIds: new Set(seed.visitedIds || []),
    seenFamilies: new Set(seed.seenFamilies || []),
    familyCounts: new Map(seed.familyCounts || []),
    genericTitleCounts: new Map(seed.genericTitleCounts || []),
    groupCounts: new Map(seed.groupCounts || [])
  };
}

export function getDiscoverFamilyKey(work) {
  const title = normalizeDiscoveryKey(work?.title || work?.cardTitle || "untitled object");
  const objectName = normalizeDiscoveryKey(work?.objectName || work?.type || work?.classification || "object");
  const context = normalizeDiscoveryKey(work?.department || work?.culture || "the met collection");
  return [title || "untitled object", objectName || "object", context || "the met collection"].join("|");
}

export function getDiscoverGenericTitleKey(work) {
  const title = normalizeDiscoveryKey(work?.title || work?.cardTitle || "untitled object");
  return GENERIC_TITLES.has(title) ? title : "";
}

export function getDiscoverGroupKey(work) {
  const department = normalizeDiscoveryKey(work?.department || "the met collection");
  const classification = normalizeDiscoveryKey(work?.classification || work?.objectName || work?.type || "object");
  return `${department || "the met collection"}|${classification || "object"}`;
}

export function reviewDiscoverCandidate(work, options = {}) {
  const globalState = options.globalState || createDiscoveryDiversityState();
  const batchState = options.batchState || createDiscoveryDiversityState();
  const allowGenericRelaxation = Boolean(options.allowGenericRelaxation);
  const id = Number(work?.id);
  const familyKey = getDiscoverFamilyKey(work);
  const genericTitleKey = getDiscoverGenericTitleKey(work);
  const groupKey = getDiscoverGroupKey(work);

  if (Number.isFinite(id)) globalState.visitedIds.add(id);

  if (!Number.isFinite(id)) {
    return { accepted: false, reason: "invalid-id", familyKey, genericTitleKey, groupKey };
  }
  if (globalState.seenIds.has(id)) {
    return { accepted: false, reason: "seen-id", familyKey, genericTitleKey, groupKey };
  }
  if (globalState.seenFamilies.has(familyKey)) {
    return { accepted: false, reason: "seen-family", familyKey, genericTitleKey, groupKey };
  }
  if (genericTitleKey && !allowGenericRelaxation) {
    if (count(batchState.genericTitleCounts, genericTitleKey) >= GENERIC_BATCH_LIMIT) {
      return { accepted: false, reason: "batch-generic", familyKey, genericTitleKey, groupKey };
    }
    if (count(globalState.genericTitleCounts, genericTitleKey) >= GENERIC_GLOBAL_LIMIT) {
      return { accepted: false, reason: "global-generic", familyKey, genericTitleKey, groupKey };
    }
  }
  if (count(batchState.groupCounts, groupKey) >= GROUP_BATCH_LIMIT) {
    return { accepted: false, reason: "batch-group", familyKey, genericTitleKey, groupKey };
  }

  globalState.seenIds.add(id);
  globalState.seenFamilies.add(familyKey);
  increment(globalState.familyCounts, familyKey);
  increment(batchState.familyCounts, familyKey);
  increment(batchState.groupCounts, groupKey);
  if (genericTitleKey) {
    increment(globalState.genericTitleCounts, genericTitleKey);
    increment(batchState.genericTitleCounts, genericTitleKey);
  }

  return { accepted: true, reason: "accepted", familyKey, genericTitleKey, groupKey };
}
