import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { proxyMetRequest } from "../api/_metProxy.js";

const apiRoot = "https://collectionapi.metmuseum.org/public/collection/v1";

async function readJson(response) {
  return response.json();
}

test("Vercel MET proxy rewrites path query to the upstream search endpoint", async () => {
  let requestedUrl = "";
  const response = await proxyMetRequest(
    new Request("https://gallery.test/api/met?path=search&q=moon&hasImages=true"),
    {
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({ total: 1, objectIDs: [437881] });
      },
      waitImpl: async () => {}
    }
  );

  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(requestedUrl, `${apiRoot}/search?q=moon&hasImages=true`);
  assert.deepEqual(payload, { total: 1, objectIDs: [437881] });
});

test("Vercel MET proxy accepts the direct /api/met/objects/:id path", async () => {
  let requestedUrl = "";
  const response = await proxyMetRequest(
    new Request("https://gallery.test/api/met/objects/197738"),
    {
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return Response.json({ objectID: 197738, title: "Armor" });
      },
      waitImpl: async () => {}
    }
  );

  const payload = await readJson(response);

  assert.equal(requestedUrl, `${apiRoot}/objects/197738`);
  assert.deepEqual(payload, { objectID: 197738, title: "Armor" });
});

test("Vercel MET proxy returns structured JSON for unsupported paths", async () => {
  let calls = 0;
  const response = await proxyMetRequest(
    new Request("https://gallery.test/api/met?path=bad/route"),
    {
      fetchImpl: async () => {
        calls += 1;
        return Response.json({});
      },
      waitImpl: async () => {}
    }
  );

  const payload = await readJson(response);

  assert.equal(calls, 0);
  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    error: {
      source: "met-proxy",
      status: 400,
      message: "Unsupported MET API proxy path.",
      retryable: false
    }
  });
});

test("Vercel MET proxy retries retryable upstream failures before reporting JSON error", async () => {
  let calls = 0;
  const response = await proxyMetRequest(
    new Request("https://gallery.test/api/met?path=departments"),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("Forbidden", {
          status: 403,
          headers: { "content-type": "text/plain" }
        });
      },
      waitImpl: async () => {}
    }
  );

  const payload = await readJson(response);

  assert.equal(calls, 3);
  assert.equal(response.status, 200);
  assert.equal(payload.error.source, "met-proxy");
  assert.equal(payload.error.status, 403);
  assert.equal(payload.error.message, "The MET API returned HTTP 403.");
  assert.equal(payload.error.url, `${apiRoot}/departments`);
  assert.equal(payload.error.retryable, true);
});

test("vercel.json routes the browser MET API path to the Vercel Function", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.equal(config.framework, null);
  assert.deepEqual(config.rewrites, [
    {
      source: "/api/met/search",
      destination: "/api/met?path=search"
    },
    {
      source: "/api/met/departments",
      destination: "/api/met?path=departments"
    },
    {
      source: "/api/met/objects/:id",
      destination: "/api/met?path=objects/:id"
    }
  ]);
  assert.equal(config.functions["api/met.js"].maxDuration, 15);
});

test("Vercel deployment ignores the unused browser bundle that Vercel detects as a server entrypoint", async () => {
  const ignore = await readFile(new URL("../.vercelignore", import.meta.url), "utf8");
  const ignoredPaths = ignore.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  assert.ok(ignoredPaths.includes("app.js"));
});
