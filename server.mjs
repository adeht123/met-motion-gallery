import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { proxyMetRequest } from "./api/_metProxy.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = resolve(join(root, relative || "index.html"));
  return candidate.startsWith(root) ? candidate : null;
}

async function writeFetchResponse(response, fetchResponse) {
  response.writeHead(fetchResponse.status, Object.fromEntries(fetchResponse.headers));
  response.end(Buffer.from(await fetchResponse.arrayBuffer()));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/met/") || url.pathname === "/api/met/search" || url.pathname === "/api/met/departments") {
      const proxyResponse = await proxyMetRequest(new Request(url.toString()));
      await writeFetchResponse(response, proxyResponse);
      return;
    }

    let path = safePath(url.pathname);
    if (!path) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const info = await stat(path);
      if (info.isDirectory()) path = join(path, "index.html");
    } catch {
      if (!extname(path)) path = join(root, "index.html");
    }

    const body = await readFile(path);
    const extension = extname(path).toLowerCase();
    const headers = {
      "Content-Type": mime[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    };

    if (extension === ".html" || extension === ".js" || extension === ".css") {
      headers["Cache-Control"] = "no-cache";
    } else {
      headers["Cache-Control"] = "public, max-age=86400";
    }

    response.writeHead(200, headers);
    response.end(body);
  } catch (error) {
    response.writeHead(error?.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error?.code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MET Motion Index running at http://localhost:${port}`);
});
