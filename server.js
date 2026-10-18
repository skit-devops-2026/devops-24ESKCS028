const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const COMMIT_SHA = process.env.COMMIT_SHA || process.env.GITHUB_SHA || "dev-commit-sha";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=UTF-8"
};

// Only the frontend is served as static files. Server code, manifests and
// configs in the same directory must never be downloadable.
const PUBLIC_FILES = new Set([
  "/index.html",
  "/login.html",
  "/register.html",
  "/profile.html",
  "/style.css",
  "/app.js",
  "/auth.js"
]);

// ---------------------------------------------------------------------------
// Metrics (Prometheus text exposition format, no external dependency)
// ---------------------------------------------------------------------------
const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const startTime = Date.now();
const requestCounts = new Map(); // "method|route|status" -> count
const latency = new Map(); // route -> { buckets: number[], sum, count }
let analyzeRequests = 0;
let analyzeFailures = 0;

function routeLabel(pathname) {
  if (pathname === "/health" || pathname === "/healthz") return "/health";
  if (pathname === "/metrics") return "/metrics";
  if (pathname === "/api/analyze") return "/api/analyze";
  if (pathname === "/" || PUBLIC_FILES.has(pathname)) return "static";
  return "other";
}

function recordRequest(method, route, status, seconds) {
  const key = `${method}|${route}|${status}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);

  let h = latency.get(route);
  if (!h) {
    h = { buckets: new Array(LATENCY_BUCKETS.length).fill(0), sum: 0, count: 0 };
    latency.set(route, h);
  }
  LATENCY_BUCKETS.forEach((le, i) => {
    if (seconds <= le) h.buckets[i]++;
  });
  h.sum += seconds;
  h.count++;
}

function renderMetrics() {
  const lines = [];
  const mem = process.memoryUsage();

  lines.push("# HELP http_requests_total Total HTTP requests by method, route and status code");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, value] of requestCounts) {
    const [method, route, status] = key.split("|");
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`);
  }

  lines.push("# HELP http_request_duration_seconds HTTP request latency in seconds");
  lines.push("# TYPE http_request_duration_seconds histogram");
  for (const [route, h] of latency) {
    LATENCY_BUCKETS.forEach((le, i) => {
      lines.push(`http_request_duration_seconds_bucket{route="${route}",le="${le}"} ${h.buckets[i]}`);
    });
    lines.push(`http_request_duration_seconds_bucket{route="${route}",le="+Inf"} ${h.count}`);
    lines.push(`http_request_duration_seconds_sum{route="${route}"} ${h.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{route="${route}"} ${h.count}`);
  }

  lines.push("# HELP analyze_requests_total Leaf analysis requests proxied to the vision API");
  lines.push("# TYPE analyze_requests_total counter");
  lines.push(`analyze_requests_total ${analyzeRequests}`);
  lines.push("# HELP analyze_failures_total Leaf analysis requests that failed");
  lines.push("# TYPE analyze_failures_total counter");
  lines.push(`analyze_failures_total ${analyzeFailures}`);

  lines.push("# HELP process_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}`);
  lines.push("# HELP process_resident_memory_bytes Resident memory size in bytes");
  lines.push("# TYPE process_resident_memory_bytes gauge");
  lines.push(`process_resident_memory_bytes ${mem.rss}`);
  lines.push("# HELP nodejs_heap_used_bytes V8 heap used in bytes");
  lines.push("# TYPE nodejs_heap_used_bytes gauge");
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);

  lines.push("# HELP app_info Build information for the running application");
  lines.push("# TYPE app_info gauge");
  lines.push(`app_info{commit="${COMMIT_SHA}",node_version="${process.version}"} 1`);
  lines.push("# HELP app_status Current application status (1 = UP, 0 = DOWN)");
  lines.push("# TYPE app_status gauge");
  lines.push("app_status 1");

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleAnalyze(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: { message: "Use POST" } });
  }
  analyzeRequests++;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    analyzeFailures++;
    return sendJson(res, 503, { error: { message: "Analysis service is not configured on the server" } });
  }

  let size = 0;
  const chunks = [];
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      analyzeFailures++;
      sendJson(res, 413, { error: { message: "Image is too large" } });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    if (res.headersSent) return;
    try {
      const upstream = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: Buffer.concat(chunks)
      });
      const text = await upstream.text();
      if (!upstream.ok) analyzeFailures++;
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(text);
    } catch (err) {
      analyzeFailures++;
      sendJson(res, 502, { error: { message: "Could not reach the analysis service" } });
    }
  });
}

function serveStatic(pathname, res) {
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  if (!PUBLIC_FILES.has(pathname)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
    return res.end("<h1>404 Not Found</h1><p>The requested file does not exist.</p>");
  }

  const filePath = path.join(__dirname, pathname);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
      return res.end("<h1>404 Not Found</h1><p>The requested file does not exist.</p>");
    }
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();
  const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  const route = routeLabel(pathname);

  res.on("finish", () => {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    recordRequest(req.method, route, res.statusCode, seconds);
  });

  // Health endpoint for DevOps monitoring and Kubernetes probes
  if (route === "/health") {
    return sendJson(res, 200, {
      status: "healthy",
      commit: COMMIT_SHA,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    });
  }

  if (route === "/metrics") {
    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=UTF-8" });
    return res.end(renderMetrics());
  }

  if (route === "/api/analyze") {
    return handleAnalyze(req, res);
  }

  serveStatic(pathname, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Krishi Clinic server running on http://localhost:${PORT}`);
    console.log(`Health endpoint available at http://localhost:${PORT}/health`);
    console.log(`Metrics endpoint available at http://localhost:${PORT}/metrics`);
  });
}

module.exports = server;
