import { normalizeMetObject } from "./normalizer.js";

export const API_ROOT = "https://collectionapi.metmuseum.org/public/collection/v1";
const API_BASE = new URL(API_ROOT);

const OBJECT_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;
const SEARCH_CACHE_TTL = 1000 * 60 * 60 * 12;
const DEPARTMENT_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
const MAX_SEARCH_IDS = 1600;

export class MetApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "MetApiError";
    this.status = options.status;
    this.cause = options.cause;
    this.url = options.url;
    this.retryable = Boolean(options.retryable);
    this.recoverable = Boolean(options.recoverable ?? options.retryable);
    this.degraded = Boolean(options.degraded);
  }
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return [...map.keys()][index] || null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function cleanQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function asInteger(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function buildSearchUrl(filters = {}) {
  const params = new URLSearchParams();
  params.set("q", cleanQuery(filters.query || "art"));

  const departmentId = asInteger(filters.departmentId);
  if (departmentId && departmentId > 0) params.set("departmentId", String(departmentId));

  const classification = cleanQuery(filters.classification);
  if (classification) params.set("medium", classification);

  const begin = asInteger(filters.dateBegin);
  const end = asInteger(filters.dateEnd);
  if (begin !== null && end !== null) {
    params.set("dateBegin", String(Math.min(begin, end)));
    params.set("dateEnd", String(Math.max(begin, end)));
  }

  if (filters.hasImages === true) params.set("hasImages", "true");
  if (filters.highlight) params.set("isHighlight", "true");
  if (filters.onView) params.set("isOnView", "true");
  if (filters.artistOrCulture) params.set("artistOrCulture", "true");

  return new URL(`${API_ROOT}/search?${params.toString()}`);
}

function cacheKey(namespace, key) {
  return `met-motion:v2:${namespace}:${encodeURIComponent(String(key)).slice(0, 240)}`;
}

function parseJSON(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readCache(storage, namespace, key, ttl, now, allowStale = true) {
  const storageKey = cacheKey(namespace, key);
  const entry = parseJSON(storage.getItem(storageKey), null);
  if (!entry || entry.key !== String(key) || !entry.timestamp) return null;
  const stale = now() - Number(entry.timestamp) > ttl;
  if (stale && !allowStale) return null;
  return { data: entry.data, stale };
}

function writeCache(storage, namespace, key, data, now) {
  const storageKey = cacheKey(namespace, key);
  const payload = JSON.stringify({ key: String(key), timestamp: now(), data });
  try {
    storage.setItem(storageKey, payload);
  } catch {
    pruneCache(storage);
    try {
      storage.setItem(storageKey, payload);
    } catch {
      // Persistent cache is an enhancement.
    }
  }
}

function pruneCache(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith("met-motion:v2:")) {
      const entry = parseJSON(storage.getItem(key), null);
      keys.push({ key, timestamp: Number(entry?.timestamp) || 0 });
    }
  }
  keys
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, Math.ceil(keys.length / 3))
    .forEach((entry) => storage.removeItem(entry.key));
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
      }, { once: true });
    }
  });
}

function timeoutController(parentSignal, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("The MET API request timed out.", "TimeoutError"));
  }, timeout);
  const parentAbort = () => controller.abort(parentSignal.reason || new DOMException("Aborted", "AbortError"));
  if (parentSignal) parentSignal.addEventListener("abort", parentAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener("abort", parentAbort);
    }
  };
}

function isRetryable(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return true;
  if (error instanceof MetApiError) return error.retryable;
  return !error?.status;
}

function defaultProxyRoot() {
  if (typeof globalThis.location === "object" && globalThis.location?.origin) return "/api/met";
  return "";
}

function requestUrl(urlString, proxyRoot) {
  const root = proxyRoot === undefined ? defaultProxyRoot() : proxyRoot;
  if (root === false || !root) return urlString;

  const url = new URL(urlString);
  if (url.origin !== API_BASE.origin || !url.pathname.startsWith(API_BASE.pathname)) return urlString;

  const apiPath = url.pathname.slice(API_BASE.pathname.length);
  const normalizedRoot = String(root).replace(/\/$/, "");
  return `${normalizedRoot}${apiPath}${url.search}`;
}

function proxyError(payload, originalUrl) {
  const error = payload?.error;
  if (!error || error.source !== "met-proxy") return null;
  const status = Number(error.status);
  const retryable = Boolean(error.retryable) || isRecoverableHttpStatus(status);
  return new MetApiError(error.message || "The MET API request failed.", {
    status,
    url: error.url || originalUrl,
    retryable,
    recoverable: retryable,
    degraded: retryable
  });
}

function isRecoverableHttpStatus(status) {
  return status === 403 || status === 429 || status >= 500;
}

export function createMetClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const storage = options.storage || globalThis.localStorage || createMemoryStorage();
  const now = options.now || (() => Date.now());
  const proxyRoot = options.proxyRoot;
  const inflight = new Map();

  if (!fetchImpl) throw new Error("A fetch implementation is required.");

  async function requestJSON(url, requestOptions = {}) {
    const urlString = String(url);
    const dedupe = requestOptions.dedupe !== false && !requestOptions.signal;
    if (dedupe && inflight.has(urlString)) return inflight.get(urlString);

    const run = async () => {
      let lastError;
      const retries = Number.isInteger(requestOptions.retries) ? requestOptions.retries : 2;
      const timeout = Number(requestOptions.timeout) || 9000;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (requestOptions.signal?.aborted) {
          throw requestOptions.signal.reason || new DOMException("Aborted", "AbortError");
        }

        const scoped = timeoutController(requestOptions.signal, timeout);
        try {
          const networkUrl = requestUrl(urlString, proxyRoot);
          const response = await fetchImpl(networkUrl, {
            signal: scoped.signal,
            headers: { Accept: "application/json" },
            cache: "default"
          });
          const payload = await response.json();
          const upstreamError = proxyError(payload, urlString);
          if (upstreamError) throw upstreamError;
          if (!response.ok) {
            const retryable = isRecoverableHttpStatus(response.status);
            throw new MetApiError(`The MET API returned HTTP ${response.status}.`, {
              status: response.status,
              url: urlString,
              retryable,
              recoverable: retryable,
              degraded: retryable
            });
          }
          return payload;
        } catch (error) {
          lastError = error;
          if (requestOptions.signal?.aborted) throw requestOptions.signal.reason || error;
          if (!isRetryable(error) || attempt >= retries) break;
          await wait(250 * (2 ** attempt), requestOptions.signal);
        } finally {
          scoped.cleanup();
        }
      }

      if (lastError instanceof MetApiError) throw lastError;
      throw new MetApiError(lastError?.message || "The MET API request failed.", {
        cause: lastError,
        url: urlString,
        retryable: true
      });
    };

    const promise = run();
    if (dedupe) inflight.set(urlString, promise);
    try {
      return await promise;
    } finally {
      if (dedupe) inflight.delete(urlString);
    }
  }

  async function getObject(id, requestOptions = {}) {
    const numericId = Number(id);
    const cached = readCache(storage, "object", numericId, OBJECT_CACHE_TTL, now, true);
    if (cached && !cached.stale) {
      return { ...cached.data, fromCache: true, stale: false };
    }

    try {
      const raw = await requestJSON(`${API_ROOT}/objects/${numericId}`, {
        signal: requestOptions.signal,
        retries: 2,
        timeout: requestOptions.timeout || 8500,
        dedupe: requestOptions.dedupe
      });
      const normalized = normalizeMetObject(raw);
      writeCache(storage, "object", numericId, normalized, now);
      return normalized;
    } catch (error) {
      if (cached) return { ...cached.data, fromCache: true, stale: true };
      throw error;
    }
  }

  async function searchObjects(filters = {}, requestOptions = {}) {
    const url = buildSearchUrl(filters);
    const key = url.toString();
    const cached = readCache(storage, "search", key, SEARCH_CACHE_TTL, now, true);
    if (cached && !cached.stale) {
      return { ...cached.data, fromCache: true, stale: false, url: key };
    }

    try {
      const raw = await requestJSON(key, {
        signal: requestOptions.signal,
        retries: 2,
        timeout: requestOptions.timeout || 11000,
        dedupe: false
      });
      const result = {
        total: Number(raw.total) || 0,
        objectIDs: Array.isArray(raw.objectIDs) ? raw.objectIDs.slice(0, MAX_SEARCH_IDS) : []
      };
      writeCache(storage, "search", key, result, now);
      return { ...result, fromCache: false, stale: false, url: key };
    } catch (error) {
      if (cached) return { ...cached.data, fromCache: true, stale: true, url: key };
      throw error;
    }
  }

  async function getDepartments(requestOptions = {}) {
    const key = `${API_ROOT}/departments`;
    const cached = readCache(storage, "departments", "all", DEPARTMENT_CACHE_TTL, now, true);
    if (cached && !cached.stale) return { departments: cached.data, fromCache: true, stale: false };

    try {
      const raw = await requestJSON(key, {
        signal: requestOptions.signal,
        retries: 1,
        timeout: requestOptions.timeout || 7000
      });
      const departments = Array.isArray(raw.departments) ? raw.departments : [];
      writeCache(storage, "departments", "all", departments, now);
      return { departments, fromCache: false, stale: false };
    } catch (error) {
      if (cached) return { departments: cached.data, fromCache: true, stale: true };
      throw error;
    }
  }

  return {
    getObject,
    searchObjects,
    getDepartments,
    requestJSON
  };
}
