const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const COMMIT_SHA = process.env.COMMIT_SHA || process.env.GITHUB_SHA || "dev-commit-sha";

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

let requestCount = 0;
const startTime = Date.now();

const server = http.createServer((req, res) => {
  requestCount++;
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = parsedUrl.pathname;

  // Health endpoint for DevOps monitoring
  if (pathname === "/health" || pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "healthy",
      commit: COMMIT_SHA,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    }));
  }

  // Prometheus metrics endpoint
  if (pathname === "/metrics") {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const metrics = [
      "# HELP http_requests_total Total number of HTTP requests made to the server",
      "# TYPE http_requests_total counter",
      `http_requests_total ${requestCount}`,
      "",
      "# HELP process_uptime_seconds Process uptime in seconds",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${uptimeSeconds}`,
      "",
      "# HELP app_status Current application status (1 = UP, 0 = DOWN)",
      "# TYPE app_status gauge",
      "app_status 1",
      ""
    ].join("\n");

    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=UTF-8" });
    return res.end(metrics);
  }

  // Default to index.html for root path
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
      return res.end("<h1>404 Not Found</h1><p>The requested file does not exist.</p>");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Krishi Clinic server running on http://localhost:${PORT}`);
    console.log(`Health endpoint available at http://localhost:${PORT}/health`);
    console.log(`Metrics endpoint available at http://localhost:${PORT}/metrics`);
  });
}

module.exports = server;
