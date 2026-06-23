const DEFAULT_LOAD_MORE_LABEL = "Load more works";
const DISCOVER_RETRY_LABEL = "Retry loading works";
const DISCOVER_END_MESSAGE = "All available MET works are visible.";
const MIN_AUTO_LOAD_INTERVAL_MS = 1600;

export function getDiscoverAutoLoadDelay({
  now,
  lastPageLoadAt
}) {
  return Math.max(0, MIN_AUTO_LOAD_INTERVAL_MS - (Number(now) - Number(lastPageLoadAt)));
}

export function getDiscoverLoadMoreState({
  mode,
  loading,
  noMore,
  initialized,
  error
}) {
  if (mode !== "curated" || loading) {
    return {
      hidden: true,
      label: DEFAULT_LOAD_MORE_LABEL,
      endMessage: ""
    };
  }

  if (noMore) {
    return {
      hidden: true,
      label: DEFAULT_LOAD_MORE_LABEL,
      endMessage: initialized ? DISCOVER_END_MESSAGE : ""
    };
  }

  if (error) {
    return {
      hidden: false,
      label: DISCOVER_RETRY_LABEL,
      endMessage: ""
    };
  }

  return {
    hidden: true,
    label: DEFAULT_LOAD_MORE_LABEL,
    endMessage: ""
  };
}

export function shouldAutoLoadDiscover({
  mode,
  loading,
  noMore,
  error,
  isIntersecting,
  elapsedMs
}) {
  return mode === "curated"
    && Boolean(isIntersecting)
    && !loading
    && !noMore
    && !error
    && getDiscoverAutoLoadDelay({ now: Number(elapsedMs), lastPageLoadAt: 0 }) === 0;
}
