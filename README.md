# Finance Dashboard Backend

A clean, production-style REST API for a finance dashboard system — built with **Node.js**, **Express**, **NeDB** (embedded document store), and **JWT authentication**.

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node.js 18+ | Native fetch, built-in test runner compatible |
| Framework | Express 5 | Minimal, battle-tested, async-friendly |
| Database | NeDB (nedb-promises) | File-based, zero setup, MongoDB-like query API |
| Auth | JWT (jsonwebtoken) | Stateless, easy to inspect |
| Validation | Zod | Schema-first, great error messages |
| Password hashing | bcryptjs | Industry standard |
| Security | helmet, cors, express-rate-limit | Sane HTTP defaults |

---

## Project Structure

```
finance-backend/
├── data/                        # NeDB flat-file databases (auto-created)
│   ├── users.db
│   └── records.db
└── src/
    ├── app.js                   # Entry point — wires middleware, routes, error handler
    ├── db.js                    # Database connections & indexes
    ├── middleware/
    │   ├── auth.js              # authenticate, authorize, requireRole, requireActive
    │   └── errorHandler.js      # Centralised error → JSON response
    ├── routes/
    │   ├── auth.js              # POST /auth/register, POST /auth/login, GET /auth/me
    │   ├── users.js             # GET/PATCH/DELETE /users (admin only)
    │   ├── records.js           # CRUD + filter /records
    │   └── dashboard.js         # Summary & analytics /dashboard/*
    ├── services/
    │   ├── authService.js       # register, login, token issue
    │   ├── userService.js       # list, get, update, soft-delete users
    │   ├── recordService.js     # list (with filters), get, create, update, soft-delete
    │   └── dashboardService.js  # overview, categories, trends, insights
    ├── utils/
    │   ├── roles.js             # ROLES, PERMISSIONS, ROLE_PERMISSIONS, can()
    │   ├── validation.js        # Zod schemas + validate() middleware factory
    │   └── seed.js              # Seed script for demo data
    └── tests/
        └── integration.test.js  # 37 integration tests (no external test runner)
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Seed the database

```bash
npm run seed
```

This creates three demo users and ~114 financial records spread across the last 12 months.

| Email | Password | Role |
|---|---|---|
| admin@demo.com | Admin123! | admin |
| analyst@demo.com | Analyst123! | analyst |
| viewer@demo.com | Viewer123! | viewer |

### 3. Start the server

```bash
npm start
# or with file-watching:
npm run dev
```

Server runs on **http://localhost:3000** by default. Override with `PORT=8080 npm start`.

### 4. Run tests

```bash
node src/tests/integration.test.js
```

All 37 tests should pass (requires seeded data).

---

## Role & Permission Model

```
VIEWER   → view:records, view:summary
ANALYST  → view:records, view:summary, view:insights
ADMIN    → all permissions (+ manage:users, create/update/delete records)
```

Each route is guarded by `authorize(PERMISSION)` middleware which checks `ROLE_PERMISSIONS[req.user.role]` — a simple, auditable map in `src/utils/roles.js`. Adding a new permission or role requires only editing that single file.

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

---

### Auth

#### `POST /auth/register`
Creates a new user account.

**Body**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Secret123!",
  "role": "viewer"           // optional, default "viewer"
}
```

**Responses** — `201 Created` | `409 Conflict` (duplicate email) | `422 Unprocessable Entity`

---

#### `POST /auth/login`
Returns a signed JWT valid for 8 hours.

**Body**
```json
{ "email": "admin@demo.com", "password": "Admin123!" }
```

**Response**
```json
{
  "token": "eyJ...",
  "user": { "_id": "...", "name": "Alice Admin", "email": "...", "role": "admin", "status": "active" }
}
```

---

#### `GET /auth/me` 🔒
Returns the authenticated user's decoded JWT payload.

---

### Financial Records

#### `GET /records` 🔒 (viewer+)
List records with optional filtering and pagination.

| Query Param | Type | Description |
|---|---|---|
| `type` | `income` \| `expense` | Filter by type |
| `category` | string | Filter by category |
| `from` | `YYYY-MM-DD` | Date range start |
| `to` | `YYYY-MM-DD` | Date range end |
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20, max 100) |
| `sortBy` | `date` \| `amount` \| `createdAt` | Sort field (default `date`) |
| `order` | `asc` \| `desc` | Sort direction (default `desc`) |

**Response**
```json
{
  "records": [...],
  "total": 114,
  "page": 1,
  "limit": 20,
  "pages": 6
}
```

---

#### `GET /records/:id` 🔒 (viewer+)
Get a single record by ID.

---

#### `POST /records` 🔒 (admin only)
Create a new financial record.

**Body**
```json
{
  "amount": 1500.00,
  "type": "income",
  "category": "freelance",
  "date": "2026-03-15",
  "notes": "Website redesign project"
}
```

Valid categories: `salary`, `freelance`, `investment`, `rent`, `utilities`, `groceries`, `transport`, `healthcare`, `entertainment`, `education`, `other`

---

#### `PATCH /records/:id` 🔒 (admin only)
Update one or more fields of a record. All fields optional.

---

#### `DELETE /records/:id` 🔒 (admin only)
Soft-deletes the record (sets `deleted: true`, not physically removed). Deleted records are excluded from all list and dashboard queries.

---

### Dashboard

#### `GET /dashboard/overview` 🔒 (viewer+)
```json
{
  "totalIncome": 62450.50,
  "totalExpenses": 28340.00,
  "netBalance": 34110.50,
  "recordCount": 113
}
```

---

#### `GET /dashboard/categories` 🔒 (viewer+)
Per-category income and expense totals.
```json
[
  { "category": "salary", "income": 54000, "expense": 0, "net": 54000 },
  { "category": "rent",   "income": 0, "expense": 14400, "net": -14400 },
  ...
]
```

---

#### `GET /dashboard/trends/monthly?months=12` 🔒 (viewer+)
Monthly income vs expense over the last N months (max 36).

---

#### `GET /dashboard/trends/weekly?weeks=8` 🔒 (viewer+)
Weekly income vs expense over the last N weeks (max 52).

---

#### `GET /dashboard/recent?limit=10` 🔒 (viewer+)
The N most recent records (max 50).

---

#### `GET /dashboard/insights` 🔒 (analyst+)
Analyst-level deeper analytics — not available to viewers.

```json
{
  "expenseToIncomeRatio": "45.4%",
  "topExpenseCategories": [...],
  "topIncomeCategories": [...],
  "last3MonthsTrend": [...]
}
```

---

### User Management (admin only)

#### `GET /users?page=1&limit=20` 🔒 (admin)
List all users with pagination.

#### `GET /users/:id` 🔒 (admin)
Get a single user by ID.

#### `PATCH /users/:id` 🔒 (admin)
Update `name`, `role`, or `status` of a user.

```json
{ "role": "analyst" }
```

#### `DELETE /users/:id` 🔒 (admin)
Soft-deactivates a user (sets `status: "inactive"`). Admins cannot deactivate themselves.

---

## Error Responses

All errors return structured JSON:

```json
{ "error": "Human-readable message" }
```

Validation failures return field-level details:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be positive" },
    { "field": "date",   "message": "Date must be YYYY-MM-DD" }
  ]
}
```

| Status | Meaning |
|---|---|
| 400 | Bad request (e.g. self-deactivation) |
| 401 | Unauthenticated |
| 403 | Forbidden (insufficient role/permission) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Design Decisions & Assumptions

### Database: NeDB
NeDB is a zero-configuration embedded document store that persists to flat files. It was chosen to keep setup friction at zero while still supporting real queries (range filters, sorting, indexes). In production, swapping to MongoDB would require only changing `db.js` — all service-layer code uses the same API.

### Soft Deletes
Both users and records are soft-deleted. Users become `status: "inactive"` and records get a `deleted: true` flag. This preserves audit trails and allows recovery without backups.

### Role Permissions as a Flat Map
Permissions are defined once in `src/utils/roles.js` as a plain object mapping roles to permission arrays. This makes the access control model immediately legible to anyone reading the code — no magic decorators or hidden policy files.

### JWT Stateless Auth
Tokens are signed with a server secret and carry the user's `id`, `email`, `role`, and `status`. The `requireActive` middleware re-checks status on every request, so deactivating a user takes effect immediately for any request that hits that guard (though existing tokens technically remain valid until expiry — a production system would add a token blacklist or shorter expiry).

### Validation at the Route Level
All input is validated before reaching the service layer. Services can therefore assume clean data and focus purely on business logic. Zod was chosen because it provides both runtime validation and TypeScript-compatible type inference (useful if this codebase were migrated to TS).

### No Separate Controller Files
Routes are thin — they validate input, call a service, and return the result. There is no value in an extra controller abstraction layer at this project size. If the project grew significantly, controllers would be extracted.

### Rate Limiting
100 requests per 15 minutes per IP. This is a reasonable default for a dashboard API. In production, you'd tune this per-route (stricter on `/auth/login`, more lenient on GET endpoints).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `finance-dashboard-secret-dev` | JWT signing secret — **change in production** |
