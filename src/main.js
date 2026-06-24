import { createMetClient } from "./metApi.js";
import { fallbackDepartments, fallbackWorks } from "./fallbackData.js";
import { mergeFallbackWithRemote } from "./normalizer.js";
import {
  EDITORIAL_PATTERN,
  getCardGridConfig,
  getScaledCardStart,
  getScaledCardSpan
} from "./cardSystem.js";
import { getCardLabelIcon, getCardLabelTone } from "./cardPresentation.js";
import {
  createDiscoveryDiversityState,
  reviewDiscoverCandidate
} from "./discoveryDiversity.js";
import {
  getDiscoverAutoLoadDelay,
  getDiscoverLoadMoreState,
  shouldAutoLoadDiscover
} from "./paginationSystem.js";
import {
  DETAIL_ENTRY_DURATION_MS,
  DETAIL_NAV_ENTER_DELAY_MS,
  DETAIL_NAV_ENTER_MS,
  DETAIL_NAV_EXIT_MS,
  getCardRevealDelay,
  getDetailEntryKeyframes,
  getDetailNavKeyframes
} from "./motionSystem.js";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const STORAGE_SAVED_KEY = "met-motion:v2:saved";
const DISCOVER_SOURCE_FILTERS = [
  "painting",
  "sculpture",
  "textile",
  "ceramic",
  "photograph",
  "drawing",
  "armor",
  "glass",
  "jewelry",
  "woodblock",
  "portrait",
  "landscape",
  "vessel",
  "manuscript",
  "furniture"
].map((query) => ({
  key: query,
  filters: {
    query,
    departmentId: 0,
    classification: "",
    dateBegin: "",
    dateEnd: "",
    hasImages: true,
    highlight: false,
    onView: false
  }
}));
const DISCOVER_TARGET_COUNT = 10;
const DISCOVER_DETAIL_BATCH_SIZE = 16;
const DISCOVER_SCAN_LIMIT = 180;
const DISCOVER_GENERIC_RELAX_AFTER = 120;

const client = createMetClient();

function createDiscoverSources() {
  return DISCOVER_SOURCE_FILTERS.map((source) => ({
    key: source.key,
    filters: { ...source.filters },
    total: 0,
    ids: [],
    cursor: 0,
    initialized: false,
    noMore: false
  }));
}

const dom = {
  root: document.documentElement,
  body: document.body,
  header: document.getElementById("site-header"),
  gallery: document.getElementById("gallery"),
  emptyState: document.getElementById("empty-state"),
  emptyKicker: document.getElementById("empty-kicker"),
  emptyTitle: document.getElementById("empty-title"),
  sentinel: document.getElementById("load-sentinel"),
  loadMore: document.getElementById("load-more"),
  endState: document.getElementById("end-state"),
  viewContext: document.getElementById("view-context"),
  statePanel: document.getElementById("state-panel"),
  stateKicker: document.getElementById("state-panel-kicker"),
  stateTitle: document.getElementById("state-panel-title"),
  stateCopy: document.getElementById("state-panel-copy"),
  stateRetry: document.getElementById("state-retry"),
  workCount: document.getElementById("work-count"),
  apiStatus: document.getElementById("api-status"),
  apiLight: document.getElementById("api-light"),
  savedCount: document.getElementById("saved-count"),
  mobileSavedCount: document.getElementById("mobile-saved-count"),
  searchDialog: document.getElementById("search-dialog"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  departmentSelect: document.getElementById("department-select"),
  classificationSelect: document.getElementById("classification-select"),
  dateBegin: document.getElementById("date-begin"),
  dateEnd: document.getElementById("date-end"),
  imagesOnly: document.getElementById("filter-images-only"),
  highlight: document.getElementById("filter-highlight"),
  onView: document.getElementById("filter-on-view"),
  detailDialog: document.getElementById("detail-dialog"),
  detailMedia: document.querySelector(".detail-media"),
  detailCard: document.querySelector(".detail-card"),
  detailIndex: document.getElementById("detail-index"),
  detailTotal: document.getElementById("detail-total"),
  detailImage: document.getElementById("detail-image"),
  detailNoImage: document.getElementById("detail-no-image"),
  detailCaption: document.getElementById("detail-image-caption"),
  detailDepartment: document.getElementById("detail-department"),
  detailObjectId: document.getElementById("detail-object-id"),
  detailTitle: document.getElementById("detail-title"),
  detailArtist: document.getElementById("detail-artist"),
  detailDate: document.getElementById("detail-date"),
  detailMedium: document.getElementById("detail-medium"),
  detailClassification: document.getElementById("detail-classification"),
  detailCulture: document.getElementById("detail-culture"),
  detailGallery: document.getElementById("detail-gallery-number"),
  detailCredit: document.getElementById("detail-credit"),
  detailLink: document.getElementById("detail-link"),
  detailSave: document.getElementById("detail-save"),
  detailShare: document.getElementById("detail-share"),
  mobileMenu: document.getElementById("mobile-menu"),
  menuButton: document.querySelector("[data-action='menu']"),
  toast: document.getElementById("toast"),
  srStatus: document.getElementById("sr-status")
};

const state = {
  mode: "curated",
  works: [],
  catalog: new Map(),
  saved: loadSavedWorks(),
  departments: fallbackDepartments,
  apiMode: "fallback",
  currentWorkId: null,
  activeSearchController: null,
  searchToken: 0,
  layoutFrame: 0,
  layoutCallbacks: [],
  revealObserver: null,
  scrollFrame: 0,
  detailTransitioning: false,
  pointerFrame: 0,
  toastTimer: 0,
  lastDetailTrigger: null,
  lastPageLoadAt: 0,
  search: {
    query: "",
    filters: null,
    total: 0,
    ids: [],
    cursor: 0,
    loading: false,
    noMore: true
  },
  discover: {
    works: [],
    total: 0,
    sources: createDiscoverSources(),
    sourceCursor: 0,
    loading: false,
    noMore: false,
    initialized: false,
    error: false,
    controller: null,
    diversity: createDiscoveryDiversityState()
  }
};

let discoverAutoLoadTimer = 0;
let lastTouchY = 0;
const DISCOVER_SCROLL_INTENT_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);

fallbackWorks.forEach((work) => {
  state.catalog.set(work.id, { ...work });
});

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function displayText(value, fallback = "Not listed") {
  const text = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function padNumber(value, size = 2) {
  return String(value).padStart(size, "0");
}

function compactText(value, max = 44) {
  const text = displayText(value, "Not listed");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadSavedWorks() {
  const stored = safeParse(localStorage.getItem(STORAGE_SAVED_KEY), []);
  return Array.isArray(stored) ? stored.filter((item) => item && Number.isFinite(Number(item.id))) : [];
}

function persistSavedWorks() {
  try {
    localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(state.saved));
  } catch {
    showToast("Saved works could not be stored in this browser.");
  }
  updateSavedCounts();
}

function cloneForStorage(work) {
  return {
    id: work.id,
    title: displayText(work.title, "Untitled object"),
    cardTitle: displayText(work.cardTitle || work.title, "Untitled object"),
    artist: displayText(work.artist, "Unknown maker"),
    date: work.date,
    medium: work.medium,
    department: work.department,
    culture: work.culture,
    classification: work.classification,
    type: work.type,
    gallery: work.gallery,
    accessionNumber: work.accessionNumber,
    dimensions: work.dimensions,
    image: work.image,
    localImage: work.localImage,
    fullImage: work.fullImage,
    hasImage: work.hasImage,
    ratio: work.ratio,
    credit: work.credit,
    objectURL: work.objectURL,
    source: work.source
  };
}

function updateSavedCounts() {
  const count = state.saved.length;
  dom.savedCount.textContent = String(count);
  dom.mobileSavedCount.textContent = String(count);
}

function isSaved(id) {
  return state.saved.some((work) => Number(work.id) === Number(id));
}

function findWork(id) {
  const numericId = Number(id);
  return state.catalog.get(numericId)
    || state.works.find((work) => Number(work.id) === numericId)
    || state.saved.find((work) => Number(work.id) === numericId);
}

function setApiMode(mode, label) {
  state.apiMode = mode;
  dom.apiLight.classList.toggle("is-live", mode === "live");
  dom.apiLight.classList.toggle("is-error", mode === "error");
  dom.apiLight.classList.toggle("is-offline", mode === "offline");

  const labels = {
    live: "Ready",
    cache: "Ready",
    fallback: "Ready",
    loading: "Loading",
    offline: "Offline",
    error: "Needs attention"
  };
  dom.apiStatus.textContent = label || labels[mode] || labels.fallback;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove("is-visible");
  }, 2600);
}

function announce(message) {
  dom.srStatus.textContent = "";
  window.setTimeout(() => {
    dom.srStatus.textContent = message;
  }, 20);
}

function showStatePanel({ kicker, title, copy, retryLabel = "Retry", onRetry }) {
  dom.stateKicker.textContent = kicker;
  dom.stateTitle.textContent = title;
  dom.stateCopy.textContent = copy;
  dom.stateRetry.textContent = retryLabel;
  dom.stateRetry.hidden = typeof onRetry !== "function";
  dom.stateRetry.onclick = onRetry || null;
  dom.statePanel.hidden = false;
}

function setSaveButtonState(button, pressed) {
  button.setAttribute("aria-pressed", String(pressed));
  if (button.classList.contains("art-card__save")) {
    button.classList.add("art-card__save--icon");
    button.setAttribute("aria-label", pressed ? "저장된 작품. 저장 해제 / Remove from saved" : "작품 저장 / Save work");
    button.setAttribute("title", pressed ? "Saved" : "Save");
    button.textContent = "";
    return;
  }

  button.setAttribute("aria-label", pressed ? "Saved work. Remove from saved" : "Save work");
  button.textContent = pressed ? "Saved" : "Save";
}

function hideStatePanel() {
  dom.statePanel.hidden = true;
  dom.stateRetry.onclick = null;
}

function createGallerySnapshot() {
  return {
    mode: state.mode,
    works: [...state.works],
    search: { ...state.search, ids: [...state.search.ids] },
    viewContext: dom.viewContext.textContent,
    workCount: dom.workCount.textContent,
    activeNavigation: document.querySelector(".nav-link.is-active")?.dataset.action || "home",
    scrollY: window.scrollY
  };
}

function restoreGallerySnapshot(snapshot) {
  if (!snapshot) return;
  state.mode = snapshot.mode;
  state.works = [...snapshot.works];
  state.search = { ...snapshot.search, ids: [...snapshot.search.ids] };
  setActiveNavigation(snapshot.activeNavigation);
  hideEmptyState();
  hideEndState();
  hideLoadMore();
  renderGallery(state.works);
  dom.viewContext.textContent = snapshot.viewContext;
  dom.workCount.textContent = snapshot.workCount;
  if (snapshot.mode === "curated") updateDiscoverControls();
  if (snapshot.mode === "search" && !state.search.noMore) setLoadMore("Load more works", false);
  window.setTimeout(() => {
    window.scrollTo({ top: snapshot.scrollY, behavior: "auto" });
  }, 0);
}

function getApiRecoveryMessage(error) {
  const status = Number(error?.status);
  if (status === 403 || status === 429 || error?.recoverable || error?.degraded) {
    return "The MET Collection is temporarily refusing requests. The current gallery is still available.";
  }
  return error?.message || "The search could not be completed. Check the connection and retry.";
}

function setLoadMore(label = "Load more works", hidden = false) {
  dom.loadMore.textContent = label;
  dom.loadMore.disabled = false;
  dom.loadMore.hidden = hidden;
}

function hideLoadMore() {
  dom.loadMore.hidden = true;
  dom.loadMore.disabled = false;
}

function showEndState(message) {
  if (!dom.endState) return;
  dom.endState.textContent = message;
  dom.endState.hidden = false;
}

function hideEndState() {
  if (!dom.endState) return;
  dom.endState.hidden = true;
}

function renderSkeleton(count = 12) {
  dom.gallery.className = "gallery gallery--skeleton";
  dom.gallery.style.height = "";
  dom.gallery.setAttribute("aria-busy", "true");
  dom.gallery.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    fragment.append(createElement("div", "skeleton-card"));
  }
  dom.gallery.append(fragment);
}

function createLoadingCell(index) {
  const layout = getCardLayout({
    id: `loading-${index}`,
    ratio: index % 3 === 0 ? 1.2 : 0.82,
    classification: "Loading"
  }, index);
  const cell = createElement("div", "art-cell art-cell--loading");
  cell.dataset.id = `loading-${index}`;
  cell.dataset.index = String(index);
  cell.dataset.span = String(layout.span);
  cell.dataset.start = layout.start === null || layout.start === undefined ? "" : String(layout.start);
  cell.dataset.offset = String(layout.offset || 0);
  cell.dataset.seed = String(hashNumber(`loading-${index}`));
  cell.dataset.variant = layout.variant;
  cell.dataset.imageKind = layout.imageKind;
  cell.append(createElement("div", `skeleton-card skeleton-card--inline skeleton-card--${layout.variant}`));
  return cell;
}

function removeAppendSkeletons(relayout = true) {
  const loadingCells = [...dom.gallery.querySelectorAll(".art-cell--loading")];
  if (!loadingCells.length) return;
  loadingCells.forEach((cell) => cell.remove());
  if (relayout) scheduleLayout(true);
}

function showAppendSkeletons(count = 6) {
  removeAppendSkeletons(false);
  const startIndex = dom.gallery.querySelectorAll(".art-cell:not(.art-cell--loading)").length;
  const fragment = document.createDocumentFragment();
  const cells = [];
  for (let offset = 0; offset < count; offset += 1) {
    const cell = createLoadingCell(startIndex + offset);
    cells.push(cell);
    fragment.append(cell);
  }
  dom.gallery.append(fragment);
  scheduleLayout(true, () => revealCells(cells));
}

function setEmptyState(kicker, title) {
  dom.emptyKicker.textContent = kicker;
  dom.emptyTitle.textContent = title;
  dom.emptyState.hidden = false;
}

function hideEmptyState() {
  dom.emptyState.hidden = true;
}

function updateWorkCount() {
  const count = state.works.length;
  dom.workCount.textContent = `${count} ${count === 1 ? "work" : "works"}`;
  dom.detailTotal.textContent = padNumber(Math.max(count, 1));
}

function updateViewContext(label, count = state.works.length) {
  dom.viewContext.textContent = `${label} / ${count} ${count === 1 ? "work" : "works"}`;
}

function setActiveNavigation(action) {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.action === action);
  });
}

function getCuratedWorks() {
  return fallbackWorks.map((work) => state.catalog.get(work.id) || work);
}

function rebuildDiscoverDiversity() {
  const diversity = createDiscoveryDiversityState();
  state.discover.works.forEach((work) => {
    reviewDiscoverCandidate(work, {
      globalState: diversity,
      batchState: createDiscoveryDiversityState(),
      allowGenericRelaxation: true
    });
  });
  state.discover.diversity = diversity;
}

function refreshDiscoverWorksFromCatalog() {
  const fallbackIds = new Set(fallbackWorks.map((work) => Number(work.id)));
  if (!state.discover.works.length) {
    state.discover.works = getCuratedWorks();
  } else {
    state.discover.works = state.discover.works.map((work) => {
      const numericId = Number(work.id);
      return fallbackIds.has(numericId) ? state.catalog.get(numericId) || work : state.catalog.get(numericId) || work;
    });
  }
  rebuildDiscoverDiversity();
  return state.discover.works;
}

function hashNumber(input) {
  const text = String(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getImageKind(work) {
  const ratio = Number(work.ratio) > 0 ? Number(work.ratio) : 0.82;
  const text = `${work.classification || ""} ${work.type || ""} ${work.medium || ""}`.toLowerCase();
  if (/photograph|print|drawing|manuscript|book|paper|album|negative|textile|tapestry/.test(text)) return "document";
  if (/sculpture|statue|marble|bronze|ceramic|glass|armor|weapon|vessel|furniture|instrument|lamp|bowl/.test(text)) return "object";
  if (ratio > 1.18) return "landscape";
  if (ratio < 0.78) return "portrait";
  return "balanced";
}

function getCardLayout(work, index) {
  const slot = EDITORIAL_PATTERN[index % EDITORIAL_PATTERN.length];
  const unit = Math.floor(index / EDITORIAL_PATTERN.length);
  const imageKind = getImageKind(work);
  const variant = slot.variant;
  let span = slot.span;
  if (variant === "feature" && imageKind === "landscape") span = 5;
  if (variant === "feature" && imageKind === "portrait") span = 4;
  const desktopConfig = getCardGridConfig(Number.POSITIVE_INFINITY);
  const maxStart = desktopConfig.columns - span;
  const mirroredStart = unit % 2 === 1 ? maxStart - slot.start : slot.start;
  return {
    variant,
    imageKind,
    span,
    start: clamp(mirroredStart, 0, maxStart),
    offset: slot.offset
  };
}

function createCard(work, index) {
  const layout = getCardLayout(work, index);
  const cell = createElement("div", "art-cell");
  cell.dataset.id = String(work.id);
  cell.dataset.index = String(index);
  cell.dataset.span = String(layout.span || 2);
  cell.dataset.start = layout.start === null || layout.start === undefined ? "" : String(layout.start);
  cell.dataset.offset = String(layout.offset || 0);
  cell.dataset.seed = String(hashNumber(work.id));
  cell.dataset.variant = layout.variant;
  cell.dataset.imageKind = layout.imageKind;

  const compact = layout.variant === "compact";
  const card = createElement("article", `art-card art-card--${layout.variant}${compact ? " art-card--small" : ""}`);
  const cardTitle = displayText(work.title || work.cardTitle, "Untitled object");
  const cardArtist = displayText(work.artist, "Unknown maker");
  card.classList.toggle("is-saved", isSaved(work.id));
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${cardTitle}, ${cardArtist}. Open details.`);
  card.dataset.id = String(work.id);

  const header = createElement("div", "art-card__header");
  const topLine = createElement("div", "art-card__topline");

  const saveButton = createElement("button", "art-card__save");
  saveButton.type = "button";
  saveButton.dataset.id = String(work.id);
  setSaveButtonState(saveButton, isSaved(work.id));

  const labelText = compactText(work.classification || work.type || work.objectName || "Object", 28);
  const labelIcon = getCardLabelIcon(work);
  const type = createElement("p", "art-card__type");
  type.dataset.tone = getCardLabelTone(work);
  if (labelIcon) {
    type.classList.add("art-card__type--icon");
    type.dataset.icon = labelIcon.slug;
    const iconImage = createElement("img", "art-card__type-icon");
    iconImage.src = labelIcon.src;
    iconImage.alt = "";
    type.append(iconImage, createElement("span", "sr-only", labelText));
  } else {
    type.classList.add("sr-only");
    type.append(createElement("span", "", labelText));
  }
  topLine.append(type, saveButton);

  const title = createElement("h2", "", cardTitle);
  const facts = createElement("div", "art-card__facts");
  const factsList = [
    compactText(cardArtist, 38),
    compactText(work.date || "Date not listed", 34)
  ].filter(Boolean);
  factsList.forEach((fact) => facts.append(createElement("span", "", fact)));
  header.append(topLine, title, facts);

  const media = createElement("div", "art-card__media");
  media.classList.add(`art-card__media--${layout.imageKind}`);
  const ratio = Number(work.ratio) > 0 ? Number(work.ratio) : 0.82;
  media.style.setProperty("--ratio", String(ratio));

  if (work.hasImage && (work.localImage || work.image || work.fullImage)) {
    const image = new Image();
    const imageSource = work.localImage || work.image || work.fullImage;
    image.alt = `${cardTitle} by ${cardArtist}`;
    image.loading = index < 7 ? "eager" : "lazy";
    image.decoding = "async";
    if (index < 4) image.fetchPriority = "high";

    const handleImageLoad = () => {
      image.classList.add("is-loaded");
      if (!image.naturalWidth || !image.naturalHeight) return;
      const naturalRatio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(naturalRatio - ratio) > 0.015) {
        media.style.setProperty("--ratio", String(naturalRatio));
        const target = findWork(work.id);
        if (target) target.ratio = naturalRatio;
        scheduleLayout();
      }
    };

    image.addEventListener("load", handleImageLoad, { once: true });
    image.addEventListener("error", () => {
      if (!image.dataset.retried && work.fullImage && image.src !== work.fullImage) {
        image.dataset.retried = "true";
        image.src = work.fullImage;
        return;
      }
      media.replaceChildren(createElement("div", "no-image-block", "Image unavailable"));
      scheduleLayout();
    });
    image.src = imageSource;
    if (image.complete && image.naturalWidth) {
      image.removeEventListener("load", handleImageLoad);
      handleImageLoad();
    }
    media.append(image);
  } else {
    media.append(createElement("div", "no-image-block", "Image unavailable"));
  }

  card.append(header, media);
  cell.append(card);

  return cell;
}

function getRevealObserver() {
  if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return null;
  if (state.revealObserver) return state.revealObserver;
  state.revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      state.revealObserver.unobserve(entry.target);
      revealCell(entry.target);
    });
  }, {
    rootMargin: "90px 0px -20px",
    threshold: 0.01
  });
  return state.revealObserver;
}

function revealCell(cell) {
  if (!cell || cell.classList.contains("is-visible")) return;
  const order = Number(cell.dataset.revealOrder) || 0;
  const delay = getCardRevealDelay(order, cell.dataset.variant, REDUCED_MOTION.matches);
  cell.style.setProperty("--reveal-delay", `${delay}ms`);
  cell.classList.add("is-revealing");
  requestAnimationFrame(() => {
    cell.classList.add("is-visible");
  });
  window.setTimeout(() => {
    cell.classList.remove("is-revealing");
    cell.style.removeProperty("--reveal-delay");
  }, delay + 460);
}

function revealCells(cells) {
  const observer = getRevealObserver();
  cells.forEach((cell, index) => {
    cell.dataset.revealOrder = String(index);
    if (observer) {
      observer.observe(cell);
    } else {
      revealCell(cell);
    }
  });
}

function renderGallery(works, options = {}) {
  const append = Boolean(options.append);
  if (append) removeAppendSkeletons(false);
  dom.gallery.classList.remove("gallery--skeleton");
  dom.gallery.setAttribute("aria-busy", "false");
  if (!append) {
    dom.gallery.replaceChildren();
    delete dom.gallery.dataset.laidOut;
  }

  const fragment = document.createDocumentFragment();
  const newCells = [];
  const startIndex = append ? dom.gallery.querySelectorAll(".art-cell:not(.art-cell--loading)").length : 0;
  works.forEach((work, offset) => {
    const cell = createCard(work, startIndex + offset);
    newCells.push(cell);
    fragment.append(cell);
  });
  dom.gallery.append(fragment);

  if (state.works.length) hideEmptyState();
  updateWorkCount();
  scheduleLayout(true, () => revealCells(newCells));
  scheduleScrollMotion();
}

function getLayoutConfig() {
  return getCardGridConfig(dom.gallery.clientWidth);
}

function chooseStart(heights, span, preferred, allowedStarts = null) {
  let bestStart = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const available = heights.length - span;
  const starts = allowedStarts || Array.from({ length: available + 1 }, (_, index) => index);
  for (const start of starts) {
    if (start < 0 || start > available) continue;
    const y = Math.max(...heights.slice(start, start + span));
    const distance = Math.abs(start - preferred);
    const edgePenalty = (start === 0 || start + span === heights.length) ? 1.6 : 0;
    const score = y + distance * 1.2 + edgePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  return bestStart;
}

function flushLayoutCallbacks() {
  const callbacks = state.layoutCallbacks.splice(0);
  callbacks.forEach((callback) => callback());
}

function layoutSequentialRows(cells, config, columnWidth, galleryRect, measuredHeights) {
  const rowSize = config.mode === "mobile" ? 1 : 2;
  let rowY = 0;

  for (let rowStart = 0; rowStart < cells.length; rowStart += rowSize) {
    let rowHeight = 0;

    for (let slot = 0; slot < rowSize; slot += 1) {
      const index = rowStart + slot;
      const cell = cells[index];
      if (!cell) continue;

      const span = Number(cell.dataset.computedSpan) || config.columns;
      const start = config.mode === "mobile" ? 0 : slot * span;
      const x = start * (columnWidth + config.gap);
      const snappedX = Math.round(galleryRect.left + x) - galleryRect.left;
      const snappedY = Math.round(galleryRect.top + rowY) - galleryRect.top;

      cell.style.transform = `translate(${snappedX}px, ${snappedY}px)`;
      rowHeight = Math.max(rowHeight, measuredHeights[index] || 0);
    }

    rowY += rowHeight + config.gap;
  }

  dom.gallery.style.height = `${Math.max(0, rowY - config.gap)}px`;
}

function layoutGallery(force = false) {
  state.layoutFrame = 0;
  if (dom.gallery.classList.contains("gallery--skeleton")) {
    flushLayoutCallbacks();
    return;
  }
  const cells = [...dom.gallery.querySelectorAll(".art-cell")];
  if (!cells.length) {
    dom.gallery.style.height = "0px";
    flushLayoutCallbacks();
    return;
  }

  const config = getLayoutConfig();
  const width = dom.gallery.clientWidth;
  const galleryRect = dom.gallery.getBoundingClientRect();
  const columnWidth = (width - config.gap * (config.columns - 1)) / config.columns;
  const firstLayout = !dom.gallery.dataset.laidOut;

  cells.forEach((cell, index) => {
    const span = getScaledCardSpan(Number(cell.dataset.span) || 2, config, index, cell.dataset.variant);
    const itemWidth = columnWidth * span + config.gap * (span - 1);
    const snappedWidth = Math.round(itemWidth);
    cell.dataset.computedSpan = String(span);
    if (firstLayout || force) cell.style.willChange = "transform";
    cell.style.width = `${snappedWidth}px`;
  });

  void dom.gallery.offsetWidth;
  const measuredHeights = cells.map((cell) => cell.offsetHeight);

  if (config.mode !== "desktop") {
    layoutSequentialRows(cells, config, columnWidth, galleryRect, measuredHeights);
    dom.gallery.dataset.laidOut = "true";
    window.setTimeout(() => {
      cells.forEach((cell) => {
        cell.style.willChange = "auto";
      });
    }, 800);
    flushLayoutCallbacks();
    return;
  }

  const heights = new Array(config.columns).fill(0);
  cells.forEach((cell, index) => {
    const span = Number(cell.dataset.computedSpan) || 2;
    const rawStart = cell.dataset.start === "" ? null : Number(cell.dataset.start);
    const seed = Number(cell.dataset.seed) || index;
    let start;

    if (rawStart !== null && config.mode !== "mobile") {
      start = getScaledCardStart(rawStart, Number(cell.dataset.span) || 2, span, config);
    } else {
      const preferred = seed % Math.max(1, config.columns - span + 1);
      const mobileStarts = config.mode === "mobile" && span === 2 ? [0, 2] : null;
      start = chooseStart(heights, span, preferred, mobileStarts);
    }

    let y = Math.max(...heights.slice(start, start + span));
    const rawOffset = Number(cell.dataset.offset) || 0;
    const offset = config.mode === "mobile" ? 0 : (rawOffset * config.offsetScale) % Math.max(config.searchOffset, 1);
    y += offset;

    const x = start * (columnWidth + config.gap);
    const snappedX = Math.round(galleryRect.left + x) - galleryRect.left;
    const snappedY = Math.round(galleryRect.top + y) - galleryRect.top;
    cell.style.transform = `translate(${snappedX}px, ${snappedY}px)`;
    const nextHeight = snappedY + measuredHeights[index] + config.gap;
    for (let column = start; column < start + span; column += 1) heights[column] = nextHeight;
  });

  dom.gallery.style.height = `${Math.max(0, Math.max(...heights, 0) - config.gap)}px`;
  dom.gallery.dataset.laidOut = "true";

  window.setTimeout(() => {
    cells.forEach((cell) => {
      cell.style.willChange = "auto";
    });
  }, 800);

  flushLayoutCallbacks();
}

function scheduleLayout(force = false, afterLayout) {
  if (typeof afterLayout === "function") state.layoutCallbacks.push(afterLayout);
  if (state.layoutFrame) cancelAnimationFrame(state.layoutFrame);
  state.layoutFrame = requestAnimationFrame(() => layoutGallery(force));
}

function scheduleScrollMotion() {
  if (state.scrollFrame) return;
  state.scrollFrame = requestAnimationFrame(updateScrollMotion);
}

function updateScrollMotion() {
  state.scrollFrame = 0;
  dom.header.classList.toggle("is-scrolled", window.scrollY > 18);
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        results[index] = { __error: error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function abortDiscoverLoad() {
  state.discover.controller?.abort();
  state.discover.controller = null;
  state.discover.loading = false;
}

async function ensureDiscoverSource(source, controller) {
  if (!source || source.initialized) return true;
  const result = await client.searchObjects(source.filters, { signal: controller.signal });
  if (controller.signal.aborted) return false;
  source.total = result.total;
  source.ids = result.objectIDs;
  source.cursor = 0;
  source.initialized = true;
  source.noMore = result.objectIDs.length === 0;
  state.discover.total = state.discover.sources.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  state.discover.initialized = state.discover.sources.some((item) => item.initialized);
  if (state.mode === "curated") setApiMode(result.fromCache ? "cache" : "live");
  return true;
}

function getNextDiscoverSource() {
  const sources = state.discover.sources;
  if (!sources.length) return null;
  for (let offset = 0; offset < sources.length; offset += 1) {
    const index = (state.discover.sourceCursor + offset) % sources.length;
    const source = sources[index];
    if (!source.noMore) return { source, index };
  }
  return null;
}

function allDiscoverSourcesExhausted() {
  return state.discover.sources.every((source) => source.noMore);
}

async function collectDiscoverCandidateIds(controller, scanBudget, maxIds = DISCOVER_DETAIL_BATCH_SIZE) {
  const ids = [];
  while (ids.length < maxIds && scanBudget.count < DISCOVER_SCAN_LIMIT) {
    const next = getNextDiscoverSource();
    if (!next) break;

    const { source, index } = next;
    const ready = await ensureDiscoverSource(source, controller);
    if (!ready || controller.signal.aborted) break;

    let found = false;
    while (source.cursor < source.ids.length && scanBudget.count < DISCOVER_SCAN_LIMIT) {
      const id = Number(source.ids[source.cursor]);
      source.cursor += 1;
      scanBudget.count += 1;
      if (!Number.isFinite(id)) continue;
      if (state.discover.diversity.visitedIds.has(id) || state.discover.diversity.seenIds.has(id)) continue;
      state.discover.diversity.visitedIds.add(id);
      ids.push(id);
      found = true;
      break;
    }

    if (source.cursor >= source.ids.length) source.noMore = true;
    state.discover.sourceCursor = (index + 1) % state.discover.sources.length;
    if (!found && allDiscoverSourcesExhausted()) break;
  }
  return ids;
}

function updateDiscoverControls() {
  if (state.mode !== "curated") return;
  const controls = getDiscoverLoadMoreState({
    mode: state.mode,
    loading: state.discover.loading,
    noMore: state.discover.noMore,
    initialized: state.discover.initialized,
    error: state.discover.error
  });
  hideEndState();
  if (controls.endMessage) showEndState(controls.endMessage);
  if (controls.hidden) {
    hideLoadMore();
  } else {
    setLoadMore(controls.label, false);
  }
}

async function loadNextDiscoverPage() {
  if (state.mode !== "curated" || state.discover.loading || state.discover.noMore) return;
  clearDiscoverAutoLoadTimer();
  abortDiscoverLoad();
  const controller = new AbortController();
  state.discover.controller = controller;
  state.discover.loading = true;
  state.discover.error = false;
  hideLoadMore();
  hideEndState();
  dom.gallery.setAttribute("aria-busy", "true");
  showAppendSkeletons(8);
  setApiMode("loading", "Loading works");

  const collected = [];
  const scanBudget = { count: 0 };
  let detailFailures = 0;
  const batchDiversity = createDiscoveryDiversityState();

  try {
    while (
      collected.length < DISCOVER_TARGET_COUNT
      && scanBudget.count < DISCOVER_SCAN_LIMIT
      && !allDiscoverSourcesExhausted()
    ) {
      const batch = await collectDiscoverCandidateIds(controller, scanBudget, DISCOVER_DETAIL_BATCH_SIZE);
      if (!batch.length) break;
      const objects = await mapPool(batch, 4, (id) => client.getObject(id, { signal: controller.signal }));
      if (controller.signal.aborted || state.mode !== "curated") return;

      objects.forEach((object) => {
        if (collected.length >= DISCOVER_TARGET_COUNT) return;
        if (!object || object.__error) {
          detailFailures += 1;
          return;
        }
        if (!object.hasImage) return;
        const review = reviewDiscoverCandidate(object, {
          globalState: state.discover.diversity,
          batchState: batchDiversity,
          allowGenericRelaxation: scanBudget.count >= DISCOVER_GENERIC_RELAX_AFTER
        });
        if (!review.accepted) return;
        state.catalog.set(object.id, object);
        collected.push(object);
      });
    }

    state.discover.noMore = allDiscoverSourcesExhausted();
    removeAppendSkeletons(false);

    if (collected.length) {
      state.discover.works.push(...collected);
      state.works = state.discover.works;
      renderGallery(collected, { append: true });
      updateViewContext("Curated index", state.works.length);
      announce(`${state.works.length} works are visible.`);
    } else {
      renderGallery(state.works);
      if (!state.discover.noMore) state.discover.error = true;
    }

    if (detailFailures > 0 && collected.length > 0) {
      setApiMode(navigator.onLine ? "error" : "offline", "Some skipped");
    } else if (state.apiMode === "loading") {
      setApiMode("live");
    }
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") return;
    removeAppendSkeletons();
    state.discover.error = true;
    setApiMode(navigator.onLine ? "error" : "offline");
    announce("More works could not be loaded. Retry is available after the gallery.");
  } finally {
    if (state.discover.controller === controller) state.discover.controller = null;
    state.discover.loading = false;
    state.lastPageLoadAt = Date.now();
    dom.gallery.setAttribute("aria-busy", "false");
    updateDiscoverControls();
  }
}

function clearDiscoverAutoLoadTimer() {
  if (!discoverAutoLoadTimer) return;
  window.clearTimeout(discoverAutoLoadTimer);
  discoverAutoLoadTimer = 0;
}

function isDiscoverAutoLoadTriggerVisible() {
  if (!dom.sentinel) return false;
  const rect = dom.sentinel.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const triggerMargin = 1000;
  return rect.top <= viewportHeight + triggerMargin && rect.bottom >= -triggerMargin;
}

function requestDiscoverAutoLoad({
  isIntersecting = isDiscoverAutoLoadTriggerVisible(),
  allowDeferredRetry = true
} = {}) {
  const now = Date.now();
  const elapsedMs = now - state.lastPageLoadAt;
  const delay = getDiscoverAutoLoadDelay({
    now,
    lastPageLoadAt: state.lastPageLoadAt
  });

  if (shouldAutoLoadDiscover({
    mode: state.mode,
    loading: state.discover.loading,
    noMore: state.discover.noMore,
    error: state.discover.error,
    isIntersecting,
    elapsedMs
  })) {
    clearDiscoverAutoLoadTimer();
    loadNextDiscoverPage();
    return true;
  }

  const canRetryLater = state.mode === "curated"
    && Boolean(isIntersecting)
    && !state.discover.loading
    && !state.discover.noMore
    && !state.discover.error
    && delay > 0;

  if (!allowDeferredRetry || !canRetryLater) {
    if (!isIntersecting || state.mode !== "curated" || state.discover.noMore || state.discover.error) {
      clearDiscoverAutoLoadTimer();
    }
    return false;
  }

  if (!discoverAutoLoadTimer) {
    discoverAutoLoadTimer = window.setTimeout(() => {
      discoverAutoLoadTimer = 0;
      requestDiscoverAutoLoad({
        isIntersecting: isDiscoverAutoLoadTriggerVisible(),
        allowDeferredRetry: false
      });
    }, delay);
  }

  return false;
}

function isEditableEventTarget(target) {
  if (!(target instanceof Element)) return false;
  return target.closest("input, textarea, select, [contenteditable='true']");
}

async function hydrateCuratedRecords() {
  const token = ++state.searchToken;
  setApiMode("loading", "Refreshing works");
  const results = await mapPool(fallbackWorks, 4, async (fallback) => {
    const remote = await client.getObject(fallback.id);
    return mergeFallbackWithRemote(fallback, remote);
  });

  if (token !== state.searchToken) return;

  let successCount = 0;
  let cacheCount = 0;
  results.forEach((result, index) => {
    const fallback = fallbackWorks[index];
    if (!result || result.__error) {
      state.catalog.set(fallback.id, fallback);
      return;
    }
    successCount += 1;
    if (result.fromCache) cacheCount += 1;
    state.catalog.set(result.id, result);
  });

  if (state.mode === "curated") {
    state.works = refreshDiscoverWorksFromCatalog();
    renderGallery(state.works);
    updateViewContext(successCount ? "Curated index" : "Curated fallback", state.works.length);
    updateDiscoverControls();
  }

  if (!successCount) {
    setApiMode(navigator.onLine ? "error" : "offline");
    showStatePanel({
      kicker: "Fallback",
      title: "Showing bundled works",
      copy: "The live collection could not be reached. You can keep browsing these works or retry the refresh.",
      onRetry: hydrateCuratedRecords
    });
    return;
  }

  hideStatePanel();
  setApiMode(cacheCount === successCount ? "cache" : "live");
}

function renderDepartmentOptions(departments) {
  dom.departmentSelect.replaceChildren();
  const fragment = document.createDocumentFragment();
  departments.forEach((department) => {
    const option = createElement("option", "", department.displayName);
    option.value = String(department.departmentId);
    fragment.append(option);
  });
  dom.departmentSelect.append(fragment);
}

async function hydrateDepartments() {
  renderDepartmentOptions(fallbackDepartments);
  try {
    const result = await client.getDepartments();
    const remoteDepartments = Array.isArray(result.departments) ? result.departments : [];
    const merged = [
      fallbackDepartments[0],
      ...remoteDepartments.filter((department) => Number(department.departmentId) > 0)
    ];
    state.departments = merged;
    renderDepartmentOptions(merged);
  } catch {
    state.departments = fallbackDepartments;
    renderDepartmentOptions(fallbackDepartments);
  }
}

function getSearchFilters(queryOverride = null) {
  return {
    query: queryOverride ?? dom.searchInput.value,
    departmentId: Number(dom.departmentSelect.value || 0),
    classification: dom.classificationSelect.value,
    dateBegin: dom.dateBegin.value,
    dateEnd: dom.dateEnd.value,
    hasImages: dom.imagesOnly.checked,
    highlight: dom.highlight.checked,
    onView: dom.onView.checked
  };
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    dialog.classList.add("is-open");
  });
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.classList.remove("is-open");
  if (REDUCED_MOTION.matches) {
    dialog.close();
    return;
  }
  window.setTimeout(() => {
    if (dialog.open && !dialog.classList.contains("is-open")) dialog.close();
  }, 180);
}

function openSearch() {
  closeMobileMenu();
  openDialog(dom.searchDialog);
  syncBodyLock();
  window.setTimeout(() => {
    dom.searchInput.focus();
    dom.searchInput.select();
  }, 80);
}

async function executeSearch(filters) {
  const cleanQuery = String(filters.query || "").replace(/\s+/g, " ").trim();
  if (cleanQuery.length < 2) {
    showToast("Enter at least two characters to search The MET Collection.");
    dom.searchInput.focus();
    return;
  }

  const previousGallery = createGallerySnapshot();
  state.activeSearchController?.abort();
  abortDiscoverLoad();
  const controller = new AbortController();
  state.activeSearchController = controller;
  const token = ++state.searchToken;

  filters.query = cleanQuery;
  state.search = {
    query: cleanQuery,
    filters,
    total: 0,
    ids: [],
    cursor: 0,
    loading: false,
    noMore: true
  };
  state.mode = "search";
  state.works = [];
  setActiveNavigation("search");
  closeDialog(dom.searchDialog);
  closeMobileMenu();
  syncBodyLock();
  hideStatePanel();
  hideEmptyState();
  hideEndState();
  hideLoadMore();
  renderSkeleton(12);
  setApiMode("loading", "Searching");
  updateViewContext(`Searching "${cleanQuery}"`, 0);
  dom.workCount.textContent = "Searching";

  try {
    const result = await client.searchObjects(filters, { signal: controller.signal });
    if (token !== state.searchToken || controller.signal.aborted) return;

    state.search.total = result.total;
    state.search.ids = result.objectIDs;
    state.search.cursor = 0;
    state.search.noMore = result.objectIDs.length === 0;

    if (!result.objectIDs.length) {
      setApiMode(result.fromCache ? "cache" : "live");
      state.works = [];
      renderGallery([]);
      setEmptyState("No matches", "Try a broader search or clear a filter.");
      updateViewContext(`Search "${cleanQuery}"`, 0);
      announce("No results found.");
      return;
    }

    setApiMode("loading", "Loading works");
    await loadNextSearchPage({ replace: true, token });
    if (token !== state.searchToken || controller.signal.aborted) return;
    if (state.apiMode === "loading") setApiMode(result.fromCache ? "cache" : "live");
    updateViewContext(`Search "${cleanQuery}"`, state.search.total || state.works.length);
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") return;
    restoreGallerySnapshot(previousGallery);
    setApiMode(navigator.onLine ? "error" : "offline");
    showStatePanel({
      kicker: "Connection",
      title: "Search failed",
      copy: getApiRecoveryMessage(error),
      retryLabel: "Retry search",
      onRetry: () => executeSearch(filters)
    });
    announce("Search failed. The current gallery remains available.");
  }
}

async function loadNextSearchPage(options = {}) {
  const replace = Boolean(options.replace);
  const token = options.token ?? state.searchToken;
  if (state.mode !== "search" || state.search.loading || state.search.noMore) return;
  state.search.loading = true;
  hideLoadMore();
  hideEndState();
  dom.gallery.setAttribute("aria-busy", "true");
  if (!replace) showAppendSkeletons(6);

  const controller = state.activeSearchController;
  const targetCount = replace ? 18 : 12;
  const collected = [];
  let scanned = 0;
  let detailFailures = 0;
  let detailAttempts = 0;

  try {
    while (
      collected.length < targetCount
      && state.search.cursor < state.search.ids.length
      && scanned < (replace ? 120 : 90)
    ) {
      const batch = state.search.ids.slice(state.search.cursor, state.search.cursor + 18);
      state.search.cursor += batch.length;
      scanned += batch.length;
      detailAttempts += batch.length;
      const objects = await mapPool(batch, 5, (id) => client.getObject(id, { signal: controller?.signal }));
      if (token !== state.searchToken || controller?.signal.aborted) return;

      objects.forEach((object) => {
        if (collected.length >= targetCount) return;
        if (!object || object.__error) {
          detailFailures += 1;
          return;
        }
        if (!Number.isFinite(Number(object.id))) return;
        if (state.search.filters?.hasImages && !object.hasImage) return;
        if (collected.some((item) => Number(item.id) === Number(object.id))) return;
        if (state.works.some((item) => Number(item.id) === Number(object.id))) return;
        collected.push(object);
        state.catalog.set(object.id, object);
      });
    }

    const allAttemptedDetailsFailed = detailAttempts > 0
      && detailFailures === detailAttempts
      && collected.length === 0
      && state.works.length === 0;

    if (allAttemptedDetailsFailed) {
      state.search.cursor = 0;
      state.search.noMore = false;
      state.works = [];
      removeAppendSkeletons(false);
      renderGallery([]);
      setApiMode(navigator.onLine ? "error" : "offline");
      showStatePanel({
        kicker: "Connection",
        title: "Details could not load",
        copy: "The search found works, but their details could not be loaded. Retry when the connection is stable.",
        retryLabel: "Retry loading",
        onRetry: () => loadNextSearchPage({ replace: true, token: state.searchToken })
      });
      setEmptyState("Object details unavailable", "Retry loading or adjust the search filters.");
      updateWorkCount();
      announce("Object details could not be loaded.");
      return;
    }

    if (replace) {
      state.works = collected;
      renderGallery(state.works);
    } else if (collected.length) {
      state.works.push(...collected);
      renderGallery(collected, { append: true });
    } else {
      removeAppendSkeletons(false);
      renderGallery(state.works);
    }

    state.search.noMore = state.search.cursor >= state.search.ids.length;
    if (state.search.noMore) {
      hideLoadMore();
      if (state.works.length) showEndState("End of search results.");
    } else {
      hideEndState();
      setLoadMore("Load more works", false);
    }
    if (!state.works.length) {
      setEmptyState("No displayable records", "The query matched records, but this batch did not include works for the current filters.");
    }
    if (detailFailures > 0 && state.works.length > 0) {
      const label = detailFailures === 1 ? "1 object record" : `${detailFailures} object records`;
      setApiMode(navigator.onLine ? "error" : "offline", "Some skipped");
      hideStatePanel();
      announce(`${label} skipped. Available works are visible.`);
    }
    updateWorkCount();
    announce(`${state.works.length} works are visible.`);
  } catch (error) {
    if (controller?.signal.aborted || error?.name === "AbortError") return;
    removeAppendSkeletons();
    setApiMode(navigator.onLine ? "error" : "offline");
    if (replace) {
      showStatePanel({
        kicker: "Connection",
        title: "Loading more failed",
        copy: error?.message || "More works could not be loaded.",
        retryLabel: "Retry loading",
        onRetry: () => loadNextSearchPage({ replace: true, token: state.searchToken })
      });
    } else {
      hideStatePanel();
      setLoadMore("Retry loading works", false);
      announce("More works could not be loaded. Retry is available after the gallery.");
    }
  } finally {
    state.search.loading = false;
    state.lastPageLoadAt = Date.now();
    dom.gallery.setAttribute("aria-busy", "false");
  }
}

function goHome() {
  state.activeSearchController?.abort();
  state.mode = "curated";
  state.works = refreshDiscoverWorksFromCatalog();
  state.search.noMore = true;
  setActiveNavigation("home");
  hideStatePanel();
  hideEmptyState();
  hideLoadMore();
  hideEndState();
  renderGallery(state.works);
  updateViewContext("Curated index", state.works.length);
  updateDiscoverControls();
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function showSaved() {
  state.activeSearchController?.abort();
  abortDiscoverLoad();
  state.mode = "saved";
  state.works = [...state.saved];
  state.search.noMore = true;
  setActiveNavigation("saved");
  hideStatePanel();
  hideLoadMore();
  hideEndState();
  renderGallery(state.works);
  updateViewContext("Saved works", state.works.length);
  if (!state.works.length) setEmptyState("Saved works", "No works are saved in this browser yet.");
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function syncBodyLock() {
  const locked = Boolean(dom.searchDialog.open || dom.detailDialog.open || !dom.mobileMenu.hidden);
  dom.body.classList.toggle("is-locked", locked);
}

function toggleMobileMenu() {
  const willOpen = dom.mobileMenu.hidden;
  dom.mobileMenu.hidden = !willOpen;
  dom.menuButton.setAttribute("aria-expanded", String(willOpen));
  dom.menuButton.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
  syncBodyLock();
}

function closeMobileMenu() {
  dom.mobileMenu.hidden = true;
  dom.menuButton.setAttribute("aria-expanded", "false");
  dom.menuButton.setAttribute("aria-label", "Open menu");
  syncBodyLock();
}

function updateSaveUI(id) {
  const pressed = isSaved(id);
  document.querySelectorAll(`.art-card__save[data-id="${Number(id)}"]`).forEach((button) => {
    setSaveButtonState(button, pressed);
  });
  document.querySelectorAll(`.art-card[data-id="${Number(id)}"]`).forEach((card) => {
    card.classList.toggle("is-saved", pressed);
  });
  if (Number(state.currentWorkId) === Number(id)) {
    setSaveButtonState(dom.detailSave, pressed);
  }
}

function toggleSaved(id) {
  const numericId = Number(id);
  const existingIndex = state.saved.findIndex((work) => Number(work.id) === numericId);
  if (existingIndex >= 0) {
    const [removed] = state.saved.splice(existingIndex, 1);
    persistSavedWorks();
    updateSaveUI(numericId);
    showToast(`${compactText(removed.title, 34)} removed from saved works.`);
    if (state.mode === "saved") showSaved();
    return;
  }

  const work = findWork(numericId);
  if (!work) return;
  state.saved.unshift(cloneForStorage(work));
  persistSavedWorks();
  updateSaveUI(numericId);
  showToast(`${compactText(work.title, 34)} saved.`);
}

function getCardMediaRect(card) {
  const media = card?.querySelector?.(".art-card__media");
  return media?.getBoundingClientRect?.() || null;
}

function getVisibleDetailMediaTarget() {
  const imageRect = dom.detailImage?.getBoundingClientRect();
  if (!dom.detailImage?.hidden && imageRect?.width > 0 && imageRect?.height > 0) {
    return dom.detailImage;
  }
  if (!dom.detailNoImage?.hidden) return dom.detailNoImage;
  return dom.detailMedia;
}

function animateElement(element, keyframes, options) {
  if (!element || typeof element.animate !== "function" || !keyframes) return Promise.resolve();
  const animation = element.animate(keyframes, options);
  return animation.finished.catch(() => {});
}

function runDetailEntryMotion(originRect) {
  if (REDUCED_MOTION.matches || !originRect) return;
  requestAnimationFrame(() => {
    const target = getVisibleDetailMediaTarget();
    const targetRect = target?.getBoundingClientRect?.();
    const keyframes = getDetailEntryKeyframes(originRect, targetRect);
    if (!keyframes) return;
    animateElement(target, keyframes, {
      duration: DETAIL_ENTRY_DURATION_MS,
      easing: "cubic-bezier(0.19, 1, 0.22, 1)",
      fill: "both"
    });
  });
}

function transitionDetailToWork(direction, updateWork) {
  if (state.detailTransitioning) return;
  if (REDUCED_MOTION.matches || typeof dom.detailMedia?.animate !== "function") {
    updateWork();
    return;
  }

  state.detailTransitioning = true;
  const keyframes = getDetailNavKeyframes(direction);
  const targets = [dom.detailMedia, dom.detailCard].filter(Boolean);
  targets.forEach((target) => target.classList.add("is-swapping"));

  Promise.all(targets.map((target) => animateElement(target, keyframes.exit, {
    duration: DETAIL_NAV_EXIT_MS,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "both"
  }))).then(() => {
    updateWork();
    return new Promise((resolve) => window.setTimeout(resolve, DETAIL_NAV_ENTER_DELAY_MS));
  }).then(() => Promise.all(targets.map((target, index) => animateElement(target, keyframes.enter, {
    duration: DETAIL_NAV_ENTER_MS,
    delay: index === 1 ? DETAIL_NAV_ENTER_DELAY_MS : 0,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "both"
  })))).finally(() => {
    targets.forEach((target) => target.classList.remove("is-swapping"));
    state.detailTransitioning = false;
  });
}

function populateDetail(work) {
  const index = Math.max(0, state.works.findIndex((item) => Number(item.id) === Number(work.id)));
  const title = displayText(work.title, "Untitled object");
  const artist = displayText(work.artist, "Unknown maker");
  const date = displayText(work.date, "Date unknown");
  const medium = displayText(work.medium, "Medium not listed");
  state.currentWorkId = work.id;
  dom.detailIndex.textContent = padNumber(index + 1);
  dom.detailTotal.textContent = padNumber(Math.max(state.works.length, 1));
  dom.detailDepartment.textContent = compactText(work.department, 48);
  dom.detailObjectId.textContent = `Object ${work.id}${work.accessionNumber ? ` / ${work.accessionNumber}` : ""}`;
  dom.detailTitle.textContent = title;
  dom.detailArtist.textContent = artist;
  dom.detailDate.textContent = date;
  dom.detailMedium.textContent = medium;
  dom.detailClassification.textContent = work.classification || work.type || "Not listed";
  dom.detailCulture.textContent = work.culture || "Not listed";
  dom.detailGallery.textContent = work.gallery || "Not listed";
  dom.detailCredit.textContent = work.credit || "The Metropolitan Museum of Art";
  dom.detailLink.href = work.objectURL || `https://www.metmuseum.org/art/collection/search/${work.id}`;
  setSaveButtonState(dom.detailSave, isSaved(work.id));
  if (dom.detailCard) dom.detailCard.scrollTop = 0;

  const imageSource = work.fullImage || work.localImage || work.image;
  if (work.hasImage && imageSource) {
    dom.detailImage.hidden = false;
    dom.detailNoImage.hidden = true;
    dom.detailImage.alt = `${title} by ${artist}`;
    dom.detailImage.src = imageSource;
  } else {
    dom.detailImage.hidden = true;
    dom.detailImage.removeAttribute("src");
    dom.detailImage.alt = "";
    dom.detailNoImage.hidden = false;
  }
  dom.detailCaption.textContent = `${title} / ${date} / ${medium}`;
}

async function openDetail(id, updateHash = true) {
  const originRect = getCardMediaRect(state.lastDetailTrigger);
  let work = findWork(id);
  if (!work) {
    try {
      work = await client.getObject(id);
      state.catalog.set(work.id, work);
      if (!state.works.length) state.works = [work];
    } catch (error) {
      showStatePanel({
        kicker: "Connection",
        title: "Details could not load",
        copy: error?.message || "The object record could not be loaded.",
        onRetry: () => openDetail(id, updateHash)
      });
      return;
    }
  }

  populateDetail(work);
  openDialog(dom.detailDialog);
  syncBodyLock();
  runDetailEntryMotion(originRect);
  if (updateHash) setWorkHash(work.id);

  if (work.source === "fallback" || !work.accessionNumber) {
    try {
      const remote = await client.getObject(work.id);
      const merged = mergeFallbackWithRemote(work, remote);
      state.catalog.set(merged.id, merged);
      const workIndex = state.works.findIndex((item) => Number(item.id) === Number(merged.id));
      if (workIndex >= 0) state.works[workIndex] = merged;
      if (Number(state.currentWorkId) === Number(merged.id)) populateDetail(merged);
    } catch {
      setApiMode(navigator.onLine ? "fallback" : "offline");
    }
  }
}

function navigateDetail(direction) {
  if (!state.works.length) return;
  const currentIndex = state.works.findIndex((work) => Number(work.id) === Number(state.currentWorkId));
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (Math.max(0, currentIndex) + delta + state.works.length) % state.works.length;
  const nextWork = state.works[nextIndex];
  transitionDetailToWork(direction, () => {
    populateDetail(nextWork);
    setWorkHash(nextWork.id);
  });
}

async function copyCurrentLink() {
  const work = findWork(state.currentWorkId);
  const url = work?.objectURL || location.href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast("MET record link copied.");
}

function setWorkHash(id) {
  history.replaceState(null, "", `${location.pathname}${location.search}#work=${id}`);
}

function clearWorkHash() {
  if (location.hash.startsWith("#work=")) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
}

function handleAction(action) {
  switch (action) {
    case "home":
      goHome();
      break;
    case "search":
      openSearch();
      break;
    case "saved":
      showSaved();
      break;
    case "menu":
      toggleMobileMenu();
      break;
    default:
      break;
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest(".art-card__save");
    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleSaved(saveButton.dataset.id);
      return;
    }

    const card = event.target.closest(".art-card");
    if (card) {
      state.lastDetailTrigger = card;
      openDetail(card.dataset.id);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleAction(actionButton.dataset.action);
      return;
    }

    const closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      const dialog = closeButton.dataset.close === "search" ? dom.searchDialog : dom.detailDialog;
      closeDialog(dialog);
      return;
    }

    const suggestion = event.target.closest("[data-query]");
    if (suggestion) {
      dom.searchInput.value = suggestion.dataset.query;
      executeSearch(getSearchFilters(suggestion.dataset.query));
      return;
    }

    const detailNav = event.target.closest("[data-detail-nav]");
    if (detailNav) navigateDetail(detailNav.dataset.detailNav);
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;

    if (event.key === "/" && !isTyping && !dom.detailDialog.open) {
      event.preventDefault();
      openSearch();
    }

    const card = target.closest?.(".art-card");
    const interactiveCardControl = target.closest?.(".art-card__save");
    if (card && (event.key === "Enter" || event.key === " ")) {
      if (interactiveCardControl) return;
      event.preventDefault();
      state.lastDetailTrigger = card;
      openDetail(card.dataset.id);
    }

    if (dom.detailDialog.open && event.key === "ArrowRight") {
      event.preventDefault();
      navigateDetail("next");
    }
    if (dom.detailDialog.open && event.key === "ArrowLeft") {
      event.preventDefault();
      navigateDetail("prev");
    }
    if (event.key === "Escape" && !dom.mobileMenu.hidden) closeMobileMenu();
  });

  dom.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    executeSearch(getSearchFilters());
  });

  dom.detailSave.addEventListener("click", () => toggleSaved(state.currentWorkId));
  dom.detailShare.addEventListener("click", copyCurrentLink);
  dom.loadMore.addEventListener("click", () => {
    if (Date.now() - state.lastPageLoadAt < 1600) return;
    if (state.mode === "search") loadNextSearchPage();
    if (state.mode === "curated") loadNextDiscoverPage();
  });

  [dom.searchDialog, dom.detailDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      dialog.classList.remove("is-open");
      syncBodyLock();
    });
  });

  dom.detailDialog.addEventListener("close", () => {
    state.currentWorkId = null;
    clearWorkHash();
    syncBodyLock();
    if (state.lastDetailTrigger?.isConnected) {
      state.lastDetailTrigger.focus({ preventScroll: true });
    }
    state.lastDetailTrigger = null;
  });

  window.addEventListener("scroll", scheduleScrollMotion, { passive: true });
  window.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) requestDiscoverAutoLoad();
  }, { passive: true });
  window.addEventListener("touchstart", (event) => {
    lastTouchY = event.touches[0]?.clientY || 0;
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    const currentY = event.touches[0]?.clientY || 0;
    if (lastTouchY && currentY < lastTouchY) requestDiscoverAutoLoad();
    lastTouchY = currentY;
  }, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (!DISCOVER_SCROLL_INTENT_KEYS.has(event.key) || isEditableEventTarget(event.target)) return;
    requestDiscoverAutoLoad();
  });
  window.addEventListener("resize", () => {
    scheduleLayout();
    scheduleScrollMotion();
  }, { passive: true });

  window.addEventListener("online", () => {
    setApiMode("loading", "Connection restored");
    hydrateCuratedRecords();
  });
  window.addEventListener("offline", () => {
    setApiMode("offline");
    showStatePanel({
      kicker: "Offline",
      title: "Showing local fallback",
      copy: "Network access is unavailable. Saved and fallback works remain browsable.",
      onRetry: hydrateCuratedRecords
    });
  });

  const sentinelObserver = new IntersectionObserver((entries) => {
    requestDiscoverAutoLoad({
      isIntersecting: entries.some((entry) => entry.isIntersecting)
    });
  }, { rootMargin: "1000px 0px" });
  sentinelObserver.observe(dom.sentinel);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Service worker support is an enhancement.
    });
  }, { once: true });
}

function initialize() {
  updateSavedCounts();
  renderDepartmentOptions(fallbackDepartments);
  renderSkeleton(12);
  setApiMode(navigator.onLine ? "fallback" : "offline");
  bindEvents();

  window.setTimeout(() => {
    state.discover.works = getCuratedWorks();
    rebuildDiscoverDiversity();
    state.works = state.discover.works;
    renderGallery(state.works);
    updateViewContext("Curated fallback", state.works.length);
    updateDiscoverControls();
    hydrateCuratedRecords();
    hydrateDepartments();
  }, REDUCED_MOTION.matches ? 0 : 220);

  registerServiceWorker();

  const hashMatch = location.hash.match(/^#work=(\d+)$/);
  if (hashMatch) window.setTimeout(() => openDetail(Number(hashMatch[1]), false), 360);
}

initialize();
