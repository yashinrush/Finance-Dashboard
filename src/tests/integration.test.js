/**
 * Integration tests — verifies auth, RBAC, records CRUD, and dashboard APIs.
 *
 * Uses Node's built-in fetch (Node 18+) and the live app instance.
 * Run: node src/tests/integration.test.js
 *
 * NOTE: Requires the database to be seeded first (npm run seed).
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");

// ── Boot the app on a random port ─────────────────────────────────────────────
const http = require("http");
process.env.PORT = 0; // OS assigns a free port

// Suppress morgan output during tests
process.env.NODE_ENV = "test";

const app = require("../app");

let server;
let BASE;

async function setup() {
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const { port } = server.address();
  BASE = `http://localhost:${port}`;
  console.log(`\n🧪  Tests running against ${BASE}\n`);
}

function teardown() {
  server.close();
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────
async function req(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── Test Runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg || `Expected ${expected}, got ${actual}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
let adminToken, analystToken, viewerToken;
let createdRecordId;

async function runAuthTests() {
  console.log("── Auth ──────────────────────────────────────────────────────");

  await test("Health check returns 200", async () => {
    const r = await req("GET", "/health");
    eq(r.status, 200);
    eq(r.body.status, "ok");
  });

  await test("Login as admin succeeds", async () => {
    const r = await req("POST", "/auth/login", { body: { email: "admin@demo.com", password: "Admin123!" } });
    eq(r.status, 200);
    assert.ok(r.body.token, "token missing");
    adminToken = r.body.token;
  });

  await test("Login as analyst succeeds", async () => {
    const r = await req("POST", "/auth/login", { body: { email: "analyst@demo.com", password: "Analyst123!" } });
    eq(r.status, 200);
    analystToken = r.body.token;
  });

  await test("Login as viewer succeeds", async () => {
    const r = await req("POST", "/auth/login", { body: { email: "viewer@demo.com", password: "Viewer123!" } });
    eq(r.status, 200);
    viewerToken = r.body.token;
  });

  await test("Login with wrong password returns 401", async () => {
    const r = await req("POST", "/auth/login", { body: { email: "admin@demo.com", password: "wrong" } });
    eq(r.status, 401);
  });

  await test("Login with invalid email format returns 422", async () => {
    const r = await req("POST", "/auth/login", { body: { email: "notanemail", password: "pw" } });
    eq(r.status, 422);
  });

  await test("GET /auth/me returns user payload", async () => {
    const r = await req("GET", "/auth/me", { token: adminToken });
    eq(r.status, 200);
    eq(r.body.user.role, "admin");
  });

  await test("GET /auth/me without token returns 401", async () => {
    const r = await req("GET", "/auth/me");
    eq(r.status, 401);
  });
}

async function runRecordTests() {
  console.log("\n── Records ───────────────────────────────────────────────────");

  await test("Admin can list records", async () => {
    const r = await req("GET", "/records", { token: adminToken });
    eq(r.status, 200);
    assert.ok(Array.isArray(r.body.records));
    assert.ok(r.body.total > 0);
  });

  await test("Viewer can list records", async () => {
    const r = await req("GET", "/records", { token: viewerToken });
    eq(r.status, 200);
  });

  await test("Records can be filtered by type", async () => {
    const r = await req("GET", "/records?type=income", { token: adminToken });
    eq(r.status, 200);
    assert.ok(r.body.records.every((rec) => rec.type === "income"), "non-income record in result");
  });

  await test("Records can be filtered by date range", async () => {
    const r = await req("GET", "/records?from=2026-01-01&to=2026-12-31", { token: adminToken });
    eq(r.status, 200);
  });

  await test("Admin can create a record", async () => {
    const r = await req("POST", "/records", {
      token: adminToken,
      body: { amount: 500, type: "income", category: "freelance", date: "2026-03-01", notes: "Test" },
    });
    eq(r.status, 201);
    assert.ok(r.body._id);
    createdRecordId = r.body._id;
  });

  await test("Viewer cannot create a record (403)", async () => {
    const r = await req("POST", "/records", {
      token: viewerToken,
      body: { amount: 100, type: "expense", category: "groceries", date: "2026-03-01" },
    });
    eq(r.status, 403);
  });

  await test("Analyst cannot create a record (403)", async () => {
    const r = await req("POST", "/records", {
      token: analystToken,
      body: { amount: 100, type: "expense", category: "groceries", date: "2026-03-01" },
    });
    eq(r.status, 403);
  });

  await test("Record creation fails with invalid data (422)", async () => {
    const r = await req("POST", "/records", {
      token: adminToken,
      body: { amount: -50, type: "bad_type", category: "groceries", date: "not-a-date" },
    });
    eq(r.status, 422);
    assert.ok(r.body.details, "no validation details");
  });

  await test("Admin can update a record", async () => {
    const r = await req("PATCH", `/records/${createdRecordId}`, {
      token: adminToken,
      body: { notes: "Updated note" },
    });
    eq(r.status, 200);
    eq(r.body.notes, "Updated note");
  });

  await test("Admin can fetch single record by ID", async () => {
    const r = await req("GET", `/records/${createdRecordId}`, { token: adminToken });
    eq(r.status, 200);
    eq(r.body._id, createdRecordId);
  });

  await test("Admin can delete (soft-delete) a record", async () => {
    const r = await req("DELETE", `/records/${createdRecordId}`, { token: adminToken });
    eq(r.status, 200);
  });

  await test("Deleted record not accessible via GET", async () => {
    const r = await req("GET", `/records/${createdRecordId}`, { token: adminToken });
    eq(r.status, 404);
  });

  await test("Fetching non-existent record returns 404", async () => {
    const r = await req("GET", "/records/nonexistent-id", { token: adminToken });
    eq(r.status, 404);
  });
}

async function runDashboardTests() {
  console.log("\n── Dashboard ─────────────────────────────────────────────────");

  await test("Admin can access overview", async () => {
    const r = await req("GET", "/dashboard/overview", { token: adminToken });
    eq(r.status, 200);
    assert.ok("totalIncome" in r.body);
    assert.ok("totalExpenses" in r.body);
    assert.ok("netBalance" in r.body);
  });

  await test("Viewer can access overview", async () => {
    const r = await req("GET", "/dashboard/overview", { token: viewerToken });
    eq(r.status, 200);
  });

  await test("Admin can access category breakdown", async () => {
    const r = await req("GET", "/dashboard/categories", { token: adminToken });
    eq(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  await test("Admin can access monthly trends", async () => {
    const r = await req("GET", "/dashboard/trends/monthly?months=6", { token: adminToken });
    eq(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  await test("Admin can access weekly trends", async () => {
    const r = await req("GET", "/dashboard/trends/weekly?weeks=4", { token: adminToken });
    eq(r.status, 200);
  });

  await test("Admin can access recent activity", async () => {
    const r = await req("GET", "/dashboard/recent?limit=5", { token: adminToken });
    eq(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.ok(r.body.length <= 5);
  });

  await test("Analyst can access insights", async () => {
    const r = await req("GET", "/dashboard/insights", { token: analystToken });
    eq(r.status, 200);
    assert.ok("expenseToIncomeRatio" in r.body);
  });

  await test("Viewer cannot access insights (403)", async () => {
    const r = await req("GET", "/dashboard/insights", { token: viewerToken });
    eq(r.status, 403);
  });
}

async function runUserTests() {
  console.log("\n── User Management ───────────────────────────────────────────");

  await test("Admin can list users", async () => {
    const r = await req("GET", "/users", { token: adminToken });
    eq(r.status, 200);
    assert.ok(Array.isArray(r.body.users));
  });

  await test("Viewer cannot list users (403)", async () => {
    const r = await req("GET", "/users", { token: viewerToken });
    eq(r.status, 403);
  });

  await test("Analyst cannot list users (403)", async () => {
    const r = await req("GET", "/users", { token: analystToken });
    eq(r.status, 403);
  });

  const tempEmail = `temp_${Date.now()}@test.com`;
  let testUserId;
  await test("Admin can create a new user via register", async () => {
    const r = await req("POST", "/auth/register", {
      body: { name: "Temp User", email: tempEmail, password: "TempPass1!", role: "viewer" },
    });
    eq(r.status, 201);
    testUserId = r.body.user._id;
  });

  await test("Admin can update user role", async () => {
    const r = await req("PATCH", `/users/${testUserId}`, {
      token: adminToken,
      body: { role: "analyst" },
    });
    eq(r.status, 200);
    eq(r.body.role, "analyst");
  });

  await test("Admin can deactivate user", async () => {
    const r = await req("DELETE", `/users/${testUserId}`, { token: adminToken });
    eq(r.status, 200);
  });

  await test("Admin cannot deactivate self", async () => {
    const me = await req("GET", "/auth/me", { token: adminToken });
    const r = await req("DELETE", `/users/${me.body.user.id}`, { token: adminToken });
    eq(r.status, 400);
  });

  await test("Duplicate email registration returns 409", async () => {
    const r = await req("POST", "/auth/register", {
      body: { name: "Dup", email: "admin@demo.com", password: "Password1!" },
    });
    eq(r.status, 409);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  await setup();

  await runAuthTests();
  await runRecordTests();
  await runDashboardTests();
  await runUserTests();

  teardown();

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`──────────────────────────────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
