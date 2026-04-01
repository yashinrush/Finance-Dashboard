const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const SALT_ROUNDS = 10;

async function register({ name, email, password, role }) {
  // Check duplicate
  const existing = await db.users.findOne({ email });
  if (existing) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    _id: uuidv4(),
    name,
    email,
    passwordHash,
    role,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await db.users.insert(user);
  return sanitizeUser(created);
}

async function login({ email, password }) {
  const user = await db.users.findOne({ email });
  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }
  if (user.status === "inactive") {
    const err = new Error("Account is inactive");
    err.status = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const payload = { id: user._id, email: user.email, role: user.role, status: user.status };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

  return { token, user: sanitizeUser(user) };
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = { register, login, sanitizeUser };
