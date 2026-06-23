const UNKNOWN = "Unknown maker";
const HTML_ENTITIES = {
  amp: "&",
  gt: ">",
  lt: "<",
  quot: "\"",
  apos: "'",
  nbsp: " "
};

function decodeEntity(entity) {
  if (entity.startsWith("#x")) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
  }
  if (entity.startsWith("#")) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`;
  }
  return HTML_ENTITIES[entity] || `&${entity};`;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => decodeEntity(entity.toLowerCase()))
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function compactDate(raw) {
  const objectDate = cleanText(raw.objectDate);
  if (objectDate) return objectDate;
  const begin = Number(raw.objectBeginDate);
  const end = Number(raw.objectEndDate);
  if (Number.isFinite(begin) && Number.isFinite(end)) {
    return begin === end ? String(begin) : `${begin}-${end}`;
  }
  if (Number.isFinite(begin)) return String(begin);
  if (Number.isFinite(end)) return String(end);
  return "Date unknown";
}

function galleryLabel(raw) {
  const gallery = cleanText(raw.GalleryNumber);
  if (gallery) return `Gallery ${gallery}`;
  if (raw.isOnView) return "On view";
  return "Not currently on view";
}

function primaryImage(raw) {
  return cleanText(raw.primaryImageSmall) || cleanText(raw.primaryImage);
}

function fullImage(raw) {
  return cleanText(raw.primaryImage) || cleanText(raw.primaryImageSmall);
}

export function normalizeMetObject(raw, options = {}) {
  const id = Number(raw?.objectID ?? raw?.id);
  const title = cleanText(raw?.title, "Untitled object");
  const objectName = cleanText(raw?.objectName);
  const classification = cleanText(raw?.classification, objectName || "Object");
  const artist = cleanText(
    raw?.artistDisplayName || raw?.artistAlphaSort || raw?.culture || raw?.country,
    UNKNOWN
  );
  const image = primaryImage(raw || {});
  const full = fullImage(raw || {});
  const medium = cleanText(raw?.medium, objectName || "Medium not listed");
  const department = cleanText(raw?.department, "The Met Collection");
  const culture = cleanText(raw?.culture || raw?.country || raw?.period, "Not listed");
  const objectURL = cleanText(raw?.objectURL, `https://www.metmuseum.org/art/collection/search/${id}`);

  return {
    id,
    title,
    cardTitle: title,
    artist,
    date: compactDate(raw || {}),
    medium,
    department,
    culture,
    classification,
    objectName,
    type: classification || objectName || "Object",
    gallery: galleryLabel(raw || {}),
    accessionNumber: cleanText(raw?.accessionNumber),
    dimensions: cleanText(raw?.dimensions),
    credit: cleanText(raw?.creditLine || raw?.repository, "The Metropolitan Museum of Art"),
    objectURL,
    image,
    fullImage: full,
    hasImage: Boolean(image || full),
    isPublicDomain: Boolean(raw?.isPublicDomain),
    isHighlight: Boolean(raw?.isHighlight),
    isOnView: Boolean(raw?.isOnView),
    tags: Array.isArray(raw?.tags) ? raw.tags.map((tag) => cleanText(tag?.term)).filter(Boolean) : [],
    source: options.source || "api",
    fromCache: Boolean(options.fromCache),
    stale: Boolean(options.stale),
    ratio: Number(options.ratio) > 0 ? Number(options.ratio) : undefined,
    layout: options.layout
  };
}

export function mergeFallbackWithRemote(fallback, remote) {
  if (!remote) return fallback;
  return {
    ...fallback,
    ...remote,
    cardTitle: fallback.cardTitle || remote.cardTitle || remote.title,
    image: fallback.localImage || fallback.image || remote.image,
    fullImage: remote.fullImage || fallback.fullImage || fallback.image,
    ratio: fallback.ratio || remote.ratio,
    layout: fallback.layout,
    source: remote.fromCache ? "cache" : "api"
  };
}
