const { v4: uuidv4 } = require("uuid");
const db = require("../db");

/**
 * Build a NeDB query object from filter params.
 */
function buildQuery(filters) {
  const query = {};

  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;

  if (filters.from || filters.to) {
    query.date = {};
    if (filters.from) query.date.$gte = filters.from;
    if (filters.to) query.date.$lte = filters.to;
  }

  return query;
}

async function listRecords(filters = {}) {
  const { page = 1, limit = 20, sortBy = "date", order = "desc", ...rest } = filters;
  const query = buildQuery(rest);

  const sortOrder = order === "asc" ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const all = await db.records.find(query).sort(sort);
  const total = all.length;
  const skip = (page - 1) * limit;
  const records = all.slice(skip, skip + limit);

  return { records, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getRecordById(id) {
  const record = await db.records.findOne({ _id: id });
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }
  return record;
}

async function createRecord(data, userId) {
  const record = {
    _id: uuidv4(),
    ...data,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return db.records.insert(record);
}

async function updateRecord(id, updates) {
  const record = await db.records.findOne({ _id: id });
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }
  const patch = { ...updates, updatedAt: new Date().toISOString() };
  await db.records.update({ _id: id }, { $set: patch });
  return db.records.findOne({ _id: id });
}

async function deleteRecord(id) {
  const record = await db.records.findOne({ _id: id });
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }
  // Soft delete
  await db.records.update({ _id: id }, { $set: { deleted: true, deletedAt: new Date().toISOString() } });
  return { message: "Record deleted" };
}

module.exports = { listRecords, getRecordById, createRecord, updateRecord, deleteRecord };
