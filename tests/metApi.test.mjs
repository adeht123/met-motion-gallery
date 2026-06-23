import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchUrl,
  createMetClient,
  createMemoryStorage
} from "../src/metApi.js";

test("buildSearchUrl maps gallery filters to official MET search params", () => {
  const url = buildSearchUrl({
    query: "silk textile",
    departmentId: 6,
    classification: "Textiles",
    dateBegin: 1700,
    dateEnd: 1800,
    hasImages: true,
    highlight: true
  });

  assert.equal(url.searchParams.get("q"), "silk textile");
  assert.equal(url.searchParams.get("departmentId"), "6");
  assert.equal(url.searchParams.get("medium"), "Textiles");
  assert.equal(url.searchParams.get("dateBegin"), "1700");
  assert.equal(url.searchParams.get("dateEnd"), "1800");
  assert.equal(url.searchParams.get("hasImages"), "true");
  assert.equal(url.searchParams.get("isHighlight"), "true");
});

test("buildSearchUrl omits incomplete date ranges and optional image filter", () => {
  const url = buildSearchUrl({
    query: "armor",
    dateBegin: 1500,
    hasImages: false
  });

  assert.equal(url.searchParams.get("q"), "armor");
  assert.equal(url.searchParams.has("dateBegin"), false);
  assert.equal(url.searchParams.has("dateEnd"), false);
  assert.equal(url.searchParams.has("hasImages"), false);
});

test("createMetClient dedupes simultaneous requests for the same object", async () => {
  let calls = 0;
  const client = createMetClient({
    storage: createMemoryStorage(),
    fetchImpl: async () => {
      calls += 1;
      return Response.json({
        objectID: 437881,
        title: "Young Woman with a Water Pitcher",
        primaryImageSmall: "https://images.metmuseum.org/example.jpg",
        artistDisplayName: "Johannes Vermeer"
      });
    }
  });

  const [a, b] = await Promise.all([client.getObject(437881), client.getObject(437881)]);

  assert.equal(calls, 1);
  assert.equal(a.id, 437881);
  assert.equal(b.title, "Young Woman with a Water Pitcher");
});

test("createMetClient serves stale cached data when the network fails", async () => {
  const storage = createMemoryStorage();
  const client = createMetClient({
    storage,
    now: () => 1_000,
    fetchImpl: async () => Response.json({
      objectID: 1,
      title: "Cached object",
      primaryImageSmall: "https://images.metmuseum.org/cached.jpg"
    })
  });

  await client.getObject(1);

  const offlineClient = createMetClient({
    storage,
    now: () => 10_000_000_000,
    fetchImpl: async () => {
      throw new Error("offline");
    }
  });

  const result = await offlineClient.getObject(1);

  assert.equal(result.title, "Cached object");
  assert.equal(result.fromCache, true);
  assert.equal(result.stale, true);
});

test("createMetClient maps browser proxy errors back to MET API errors", async () => {
  let requestedUrl = "";
  const client = createMetClient({
    storage: createMemoryStorage(),
    proxyRoot: "/api/met",
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        error: {
          source: "met-proxy",
          status: 403,
          message: "The MET API returned HTTP 403.",
          url: "https://collectionapi.metmuseum.org/public/collection/v1/objects/197738",
          retryable: false
        }
      });
    }
  });

  await assert.rejects(
    () => client.getObject(197738),
    (error) => {
      assert.equal(error.name, "MetApiError");
      assert.equal(error.status, 403);
      assert.equal(error.retryable, true);
      assert.equal(error.recoverable, true);
      return true;
    }
  );
  assert.equal(requestedUrl, "/api/met/objects/197738");
});

test("createMetClient retries retryable proxy 403 responses before succeeding", async () => {
  let calls = 0;
  const client = createMetClient({
    storage: createMemoryStorage(),
    proxyRoot: "/api/met",
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) {
        return Response.json({
          error: {
            source: "met-proxy",
            status: 403,
            message: "The MET API returned HTTP 403.",
            retryable: false
          }
        });
      }
      return Response.json({
        total: 2,
        objectIDs: [437881, 436121]
      });
    }
  });

  const result = await client.searchObjects({ query: "moon", hasImages: true });

  assert.equal(calls, 3);
  assert.deepEqual(result.objectIDs, [437881, 436121]);
  assert.equal(result.fromCache, false);
});

test("createMetClient serves stale search cache when proxy 403 keeps failing", async () => {
  const storage = createMemoryStorage();
  const cachedClient = createMetClient({
    storage,
    now: () => 1_000,
    fetchImpl: async () => Response.json({
      total: 1,
      objectIDs: [437881]
    })
  });

  await cachedClient.searchObjects({ query: "moon", hasImages: true });

  const failingClient = createMetClient({
    storage,
    now: () => 1000 * 60 * 60 * 24,
    proxyRoot: "/api/met",
    fetchImpl: async () => Response.json({
      error: {
        source: "met-proxy",
        status: 403,
        message: "The MET API returned HTTP 403.",
        retryable: false
      }
    })
  });

  const result = await failingClient.searchObjects({ query: "moon", hasImages: true });

  assert.deepEqual(result.objectIDs, [437881]);
  assert.equal(result.fromCache, true);
  assert.equal(result.stale, true);
});
