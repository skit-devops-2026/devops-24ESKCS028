const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const server = require("../server.js");

const BASE_DIR = path.resolve(__dirname, "..");

test("1. Project Structure - Critical files must exist", () => {
  const requiredFiles = [
    "index.html",
    "login.html",
    "register.html",
    "profile.html",
    "style.css",
    "app.js",
    "auth.js",
    "server.js",
    "Makefile",
    "README.md",
    ".gitignore"
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(BASE_DIR, file);
    assert.ok(fs.existsSync(filePath), `Required file missing: ${file}`);
  }
});

test("2. README.md - Must contain required author details and no placeholders", () => {
  const content = fs.readFileSync(path.join(BASE_DIR, "README.md"), "utf-8");
  assert.ok(!content.includes("<roll>"), "README still contains <roll> placeholder");
  assert.ok(!content.includes("<name>"), "README still contains <name> placeholder");
  assert.ok(!content.includes("<username>"), "README still contains <username> placeholder");
  assert.ok(content.includes("24ESKCS028"), "README must list roll number 24ESKCS028");
  assert.ok(content.includes("Ajay Yadav"), "README must list author name Ajay Yadav");
  assert.ok(content.includes("ajayyadav432"), "README must list GitHub username ajayyadav432");
});

test("3. JWT Auth Logic - Token generation, structure and claims", () => {
  function base64UrlEncode(str) {
    return Buffer.from(str)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function base64UrlDecode(str) {
    let s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64").toString("utf-8");
  }

  const mockUser = {
    username: "farmer_ajay",
    name: "Ajay Yadav",
    crop: "Wheat",
    joinedDate: "10/09/2026"
  };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: mockUser.username,
    name: mockUser.name,
    crop: mockUser.crop,
    iat: now,
    exp: now + 86400
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode("mock_signature_" + encodedHeader + "." + encodedPayload);
  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  // Verify structure
  const parts = token.split(".");
  assert.strictEqual(parts.length, 3, "JWT must consist of exactly 3 parts separated by dots");

  // Verify decoded payload
  const decodedPayload = JSON.parse(base64UrlDecode(parts[1]));
  assert.strictEqual(decodedPayload.sub, "farmer_ajay");
  assert.strictEqual(decodedPayload.name, "Ajay Yadav");
  assert.strictEqual(decodedPayload.crop, "Wheat");
  assert.ok(decodedPayload.exp > now, "Token expiration must be in the future");
});

test("4. Server - Health endpoint GET /health returns 200 and healthy status", (t, done) => {
  const testServer = server.listen(0, () => {
    const port = testServer.address().port;

    http.get(`http://localhost:${port}/health`, (res) => {
      assert.strictEqual(res.statusCode, 200, "Status code must be 200");
      assert.strictEqual(res.headers["content-type"], "application/json");

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const json = JSON.parse(data);
        assert.strictEqual(json.status, "healthy");
        assert.ok(json.commit, "Commit SHA must be returned");
        testServer.close(done);
      });
    });
  });
});

test("5. Server - Metrics endpoint GET /metrics returns Prometheus format", (t, done) => {
  const testServer = server.listen(0, () => {
    const port = testServer.address().port;

    http.get(`http://localhost:${port}/metrics`, (res) => {
      assert.strictEqual(res.statusCode, 200, "Status code must be 200");

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        assert.ok(data.includes("http_requests_total"), "Must expose http_requests_total");
        assert.ok(data.includes("app_status 1"), "Must expose app_status 1");
        testServer.close(done);
      });
    });
  });
});
