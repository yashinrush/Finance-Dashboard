const Datastore = require("nedb-promises");
const path = require("path");
const fs = require("fs");

let dbDir = path.join(__dirname, "../data");

// If running on Vercel, copy the static database to the writable /tmp directory
if (process.env.VERCEL) {
  dbDir = path.join("/tmp", "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    try {
      const sourceDir = path.join(__dirname, "../data");
      if (fs.existsSync(sourceDir)) {
        fs.readdirSync(sourceDir).forEach(file => {
          fs.copyFileSync(path.join(sourceDir, file), path.join(dbDir, file));
        });
      }
    } catch (e) {
      console.error("Failed to copy DB files to /tmp:", e);
    }
  }
}

const db = {
  users: Datastore.create({ filename: path.join(dbDir, "users.db"), autoload: true }),
  records: Datastore.create({ filename: path.join(dbDir, "records.db"), autoload: true }),
};

// Ensure indexes for common queries
db.users.ensureIndex({ fieldName: "email", unique: true });
db.records.ensureIndex({ fieldName: "userId" });
db.records.ensureIndex({ fieldName: "date" });

module.exports = db;
