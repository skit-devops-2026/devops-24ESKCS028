const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
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

// Load the real browser auth.js into a sandbox with minimal DOM stubs so the
// shipped token code is what gets tested, not a copy of it.
function loadAuthModule() {
  const store = {};
  const context = {
    window: { location: { pathname: "/index.html", href: "" } },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: {},
    $: () => ({ ready() {} }),
    btoa,
    atob
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(BASE_DIR, "auth.js"), "utf-8"), context);
  return context;
}

test("3a. auth.js - createJwtToken produces a decodable 3-part token", () => {
  const auth = loadAuthModule();
  const user = { username: "farmer_ajay", name: "Ajay Yadav", crop: "Wheat", joinedDate: "10/09/2026" };

  const token = auth.createJwtToken(user);
  assert.strictEqual(token.split(".").length, 3, "JWT must have header.payload.signature");

  const payload = auth.verifyAndDecodeJwt(token);
  assert.ok(payload, "A freshly issued token must verify");
  assert.strictEqual(payload.sub, "farmer_ajay");
  assert.strictEqual(payload.crop, "Wheat");
  assert.ok(payload.exp > payload.iat, "Token must expire after it was issued");
});

test("3b. auth.js - non-ASCII names survive encode/decode", () => {
  const auth = loadAuthModule();
  const token = auth.createJwtToken({ username: "kisan", name: "अजय यादव", crop: "गेहूं" });
  assert.strictEqual(auth.verifyAndDecodeJwt(token).name, "अजय यादव");
});

test("3c. auth.js - rejects expired, malformed and missing tokens", () => {
  const auth = loadAuthModule();
  const enc = (o) => auth.base64UrlEncode(JSON.stringify(o));
  const past = Math.floor(Date.now() / 1000) - 60;
  const expired = `${enc({ alg: "HS256" })}.${enc({ sub: "x", exp: past })}.sig`;

  assert.strictEqual(auth.verifyAndDecodeJwt(expired), null, "Expired token must be rejected");
  assert.strictEqual(auth.verifyAndDecodeJwt("not-a-jwt"), null, "Token without 3 parts must be rejected");
  assert.strictEqual(auth.verifyAndDecodeJwt("a.%%%.c"), null, "Undecodable payload must be rejected");
  assert.strictEqual(auth.verifyAndDecodeJwt(""), null);
  assert.strictEqual(auth.verifyAndDecodeJwt(null), null);
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

// Small helper: start the server on a random port, make one request, close.
function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const testServer = server.listen(0, () => {
      const req = http.request(
        { host: "localhost", port: testServer.address().port, path: urlPath, method,
          headers: body ? { "Content-Type": "application/json" } : {} },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => testServer.close(() => resolve({ status: res.statusCode, headers: res.headers, body: data })));
        }
      );
      req.on("error", (e) => testServer.close(() => reject(e)));
      if (body) req.write(body);
      req.end();
    });
  });
}

test("5. Server - /metrics exposes labelled counters, latency histogram and memory", async () => {
  await request("GET", "/health");
  const res = await request("GET", "/metrics");

  assert.strictEqual(res.status, 200);
  assert.match(res.headers["content-type"], /^text\/plain/);
  assert.match(res.body, /# TYPE http_requests_total counter/);
  assert.match(res.body, /http_requests_total\{method="GET",route="\/health",status="200"\} [1-9]/,
    "The earlier /health request must be counted with its labels");
  assert.match(res.body, /# TYPE http_request_duration_seconds histogram/);
  assert.match(res.body, /http_request_duration_seconds_bucket\{route="\/health",le="\+Inf"\} [1-9]/);
  assert.match(res.body, /process_resident_memory_bytes [1-9]\d*/);
  assert.match(res.body, /app_status 1/);
});

test("6. Server - request counter increases between scrapes", async () => {
  const count = (body) => {
    const m = body.match(/http_requests_total\{method="GET",route="static",status="200"\} (\d+)/);
    return m ? Number(m[1]) : 0;
  };
  const before = count((await request("GET", "/metrics")).body);
  await request("GET", "/index.html");
  await request("GET", "/style.css");
  const after = count((await request("GET", "/metrics")).body);
  assert.strictEqual(after - before, 2);
});

test("7. Server - static files are served with the correct MIME type", async () => {
  const root = await request("GET", "/");
  assert.strictEqual(root.status, 200);
  assert.match(root.headers["content-type"], /text\/html/);
  assert.match(root.body, /<html/i);

  const css = await request("GET", "/style.css");
  assert.match(css.headers["content-type"], /text\/css/);
});

test("8. Server - does not leak server code, config or files outside the web root", async () => {
  for (const p of ["/server.js", "/package.json", "/.env.example", "/Dockerfile", "/k8s/deployment.yaml",
                   "/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/nope.html"]) {
    const res = await request("GET", p);
    assert.strictEqual(res.status, 404, `${p} must not be served`);
  }
});

test("9. Server - /api/analyze rejects GET and reports missing API key", async () => {
  const saved = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    assert.strictEqual((await request("GET", "/api/analyze")).status, 405);

    const res = await request("POST", "/api/analyze", JSON.stringify({ messages: [] }));
    assert.strictEqual(res.status, 503);
    assert.match(JSON.parse(res.body).error.message, /not configured/);
  } finally {
    if (saved !== undefined) process.env.GROQ_API_KEY = saved;
  }
});

test("9b. Server - /api/analyze forces the server-side model and rejects bad JSON", async () => {
  const savedKey = process.env.GROQ_API_KEY;
  const savedFetch = global.fetch;
  let sentBody;
  process.env.GROQ_API_KEY = "test-key";
  global.fetch = async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }) };
  };
  try {
    const bad = await request("POST", "/api/analyze", "not json");
    assert.strictEqual(bad.status, 400);

    const res = await request("POST", "/api/analyze", JSON.stringify({ model: "some-expensive-model", messages: [] }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(sentBody.model, "qwen/qwen3.8-27b", "Client must not choose the model");
  } finally {
    global.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = savedKey;
  }
});

test("10. Frontend - no API key is shipped to the browser", () => {
  for (const file of ["app.js", "auth.js", "index.html"]) {
    const src = fs.readFileSync(path.join(BASE_DIR, file), "utf-8");
    assert.ok(!/gsk_[A-Za-z0-9]{20,}/.test(src), `${file} contains a Groq key`);
    assert.ok(!/Z3NrX[A-Za-z0-9+/=]{20,}/.test(src), `${file} contains a base64-encoded Groq key`);
    assert.ok(!src.includes("api.groq.com"), `${file} calls the vision API directly`);
  }
});
