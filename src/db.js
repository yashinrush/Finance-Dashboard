const Datastore = require("nedb-promises");
const path = require("path");

const dbDir = path.join(__dirname, "../data");

const db = {
  users: Datastore.create({ filename: path.join(dbDir, "users.db"), autoload: true }),
  records: Datastore.create({ filename: path.join(dbDir, "records.db"), autoload: true }),
};

// Ensure indexes for common queries
db.users.ensureIndex({ fieldName: "email", unique: true });
db.records.ensureIndex({ fieldName: "userId" });
db.records.ensureIndex({ fieldName: "date" });

module.exports = db;
