const metApiRoot = "https://collectionapi.metmuseum.org/public/collection/v1";
const proxyRetryStatuses = new Set([403, 429]);

function json(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function isRetryableProxyStatus(status) {
  return proxyRetryStatuses.has(status) || status >= 500;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getApiPath(url) {
  const rewrittenPath = url.searchParams.get("path");
  if (rewrittenPath !== null) {
    return `/${rewrittenPath.replace(/^\/+/, "")}`;
  }

  if (url.pathname === "/api/met") return "/";
  if (url.pathname.startsWith("/api/met/")) return url.pathname.slice("/api/met".length);
  return url.pathname;
}

function getUpstreamUrl(url) {
  const apiPath = getApiPath(url);
  if (!/^\/(objects\/\d+|search|departments)$/.test(apiPath)) return null;

  const upstreamUrl = new URL(`${metApiRoot}${apiPath}`);
  url.searchParams.forEach((value, key) => {
    if (key !== "path") upstreamUrl.searchParams.append(key, value);
  });
  return upstreamUrl;
}

async function fetchMetUpstream(upstreamUrl, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const waitImpl = options.waitImpl || wait;

  if (!fetchImpl) throw new Error("A fetch implementation is required.");

  let upstream;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    upstream = await fetchImpl(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "The MET Motion Gallery Vercel Function"
      }
    });
    if (!isRetryableProxyStatus(upstream.status) || attempt >= 2) return upstream;
    await upstream.arrayBuffer().catch(() => null);
    await waitImpl(250 * (2 ** attempt));
  }
  return upstream;
}

export async function proxyMetRequest(request, options = {}) {
  const url = new URL(request.url);
  const upstreamUrl = getUpstreamUrl(url);

  if (!upstreamUrl) {
    return json({
      error: {
        source: "met-proxy",
        status: 400,
        message: "Unsupported MET API proxy path.",
        retryable: false
      }
    });
  }

  try {
    const upstream = await fetchMetUpstream(upstreamUrl, options);
    const text = await upstream.text();

    if (!upstream.ok) {
      const retryable = isRetryableProxyStatus(upstream.status);
      return json({
        error: {
          source: "met-proxy",
          status: upstream.status,
          message: `The MET API returned HTTP ${upstream.status}.`,
          url: upstreamUrl.toString(),
          retryable
        }
      });
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return json({
      error: {
        source: "met-proxy",
        message: error?.message || "The MET API request failed.",
        url: upstreamUrl.toString(),
        retryable: true
      }
    });
  }
}
