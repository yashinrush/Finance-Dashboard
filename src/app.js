const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Rate limiting: 100 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));
app.use("/records", require("./routes/records"));
app.use("/dashboard", require("./routes/dashboard"));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Static Frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ─── 404 Catch-all (API routes only) ─────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/users") ||
      req.path.startsWith("/records") || req.path.startsWith("/dashboard") ||
      req.path === "/health") {
    return res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  }
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(require("./middleware/errorHandler"));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  Finance Backend running on http://localhost:${PORT}`);
  console.log(`   Docs: see README.md`);
  console.log(`   Seed: npm run seed\n`);
});

module.exports = app;
