import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getDiscoverLoadMoreState,
  shouldAutoLoadDiscover
} from "../src/paginationSystem.js";

test("Discover normal pagination hides Load More for infinite scroll", () => {
  assert.deepEqual(getDiscoverLoadMoreState({
    mode: "curated",
    loading: false,
    noMore: false,
    initialized: true,
    error: false
  }), {
    hidden: true,
    label: "Load more works",
    endMessage: ""
  });
});

test("Discover only shows Retry when automatic loading failed", () => {
  assert.deepEqual(getDiscoverLoadMoreState({
    mode: "curated",
    loading: false,
    noMore: false,
    initialized: true,
    error: true
  }), {
    hidden: false,
    label: "Retry loading works",
    endMessage: ""
  });
});

test("Discover end state remains buttonless when all works are exhausted", () => {
  assert.deepEqual(getDiscoverLoadMoreState({
    mode: "curated",
    loading: false,
    noMore: true,
    initialized: true,
    error: false
  }), {
    hidden: true,
    label: "Load more works",
    endMessage: "All available MET works are visible."
  });
});

test("Discover sentinel only auto-loads when the gallery can accept another batch", () => {
  assert.equal(shouldAutoLoadDiscover({
    mode: "curated",
    loading: false,
    noMore: false,
    error: false,
    isIntersecting: true,
    elapsedMs: 1600
  }), true);

  assert.equal(shouldAutoLoadDiscover({
    mode: "search",
    loading: false,
    noMore: false,
    error: false,
    isIntersecting: true,
    elapsedMs: 1600
  }), false);

  assert.equal(shouldAutoLoadDiscover({
    mode: "curated",
    loading: false,
    noMore: false,
    error: true,
    isIntersecting: true,
    elapsedMs: 1600
  }), false);
});

test("Discover auto-load throttle reports the remaining delay for scroll intent retries", async () => {
  const pagination = await import("../src/paginationSystem.js");
  assert.equal(typeof pagination.getDiscoverAutoLoadDelay, "function");

  assert.equal(pagination.getDiscoverAutoLoadDelay({
    now: 2600,
    lastPageLoadAt: 1000
  }), 0);

  assert.equal(pagination.getDiscoverAutoLoadDelay({
    now: 2200,
    lastPageLoadAt: 1000
  }), 400);
});

test("sentinel observer is Discover-only while the Search Load More click path remains", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const clickStart = source.indexOf("dom.loadMore.addEventListener");
  const clickEnd = source.indexOf("[dom.searchDialog, dom.detailDialog]", clickStart);
  const clickSource = source.slice(clickStart, clickEnd);
  const observerStart = source.indexOf("const sentinelObserver = new IntersectionObserver");
  const observerEnd = source.indexOf("sentinelObserver.observe", observerStart);
  const observerSource = source.slice(observerStart, observerEnd);

  assert.match(clickSource, /state\.mode === "search"[\s\S]*loadNextSearchPage\(\)/);
  assert.match(clickSource, /state\.mode === "curated"[\s\S]*loadNextDiscoverPage\(\)/);
  assert.doesNotMatch(observerSource, /loadNextSearchPage\(\)/);
  assert.match(observerSource, /requestDiscoverAutoLoad/);
});

test("Discover scroll-intent fallback queues one retry without changing Search pagination", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const helperStart = source.indexOf("function requestDiscoverAutoLoad");
  const helperEnd = source.indexOf("function bindEvents", helperStart);
  const helperSource = source.slice(helperStart, helperEnd);
  const observerStart = source.indexOf("const sentinelObserver = new IntersectionObserver");
  const observerEnd = source.indexOf("sentinelObserver.observe", observerStart);
  const observerSource = source.slice(observerStart, observerEnd);

  assert.notEqual(helperStart, -1);
  assert.match(helperSource, /getDiscoverAutoLoadDelay/);
  assert.match(helperSource, /setTimeout/);
  assert.match(helperSource, /discoverAutoLoadTimer/);
  assert.match(observerSource, /requestDiscoverAutoLoad/);
  assert.match(source, /addEventListener\("wheel"[\s\S]*requestDiscoverAutoLoad/);
  assert.match(source, /addEventListener\("touchmove"[\s\S]*requestDiscoverAutoLoad/);
  assert.match(source, /addEventListener\("keydown"[\s\S]*requestDiscoverAutoLoad/);
  assert.doesNotMatch(helperSource, /loadNextSearchPage\(\)/);
});
