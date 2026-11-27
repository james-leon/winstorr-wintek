// Vercel serverless adapter for the TanStack Start universal server.
// Bridges Node (req, res) <-> Web (Request/Response), delegating to the built handler.
import { Readable } from "node:stream";
import serverEntry from "../dist/server/server.js";

const handler = serverEntry.default ?? serverEntry;

export default async function (req, res) {
  try {
    const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0];
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "localhost").toString();
    const url = `${proto}://${host}${req.url}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) for (const v of value) headers.append(key, v);
      else if (value != null) headers.set(key, String(value));
    }

    const method = (req.method || "GET").toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const request = new Request(url, {
      method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
    });

    const response = await handler.fetch(request, {}, {});
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("SSR adapter error:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end("<h1>500 — Server error</h1>");
  }
}
