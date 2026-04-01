const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { sanitizeUser } = require("./authService");

async function listUsers({ page = 1, limit = 20 } = {}) {
  const all = await db.users.find({}).sort({ createdAt: -1 });
  const total = all.length;
  const skip = (page - 1) * limit;
  const users = all.slice(skip, skip + limit).map(sanitizeUser);
  return { users, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getUserById(id) {
  const user = await db.users.findOne({ _id: id });
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return sanitizeUser(user);
}

async function updateUser(id, updates) {
  const user = await db.users.findOne({ _id: id });
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const patch = { ...updates, updatedAt: new Date().toISOString() };
  await db.users.update({ _id: id }, { $set: patch });

  const updated = await db.users.findOne({ _id: id });
  return sanitizeUser(updated);
}

async function deleteUser(id) {
  const user = await db.users.findOne({ _id: id });
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  // Soft delete — set status to inactive
  await db.users.update({ _id: id }, { $set: { status: "inactive", updatedAt: new Date().toISOString() } });
  return { message: "User deactivated" };
}

module.exports = { listUsers, getUserById, updateUser, deleteUser };
