/**
 * Seed script — populates the database with demo users and financial records.
 * Run: npm run seed
 *
 * Creates:
 *   admin@demo.com  / password: Admin123!   (role: admin)
 *   analyst@demo.com / password: Analyst123! (role: analyst)
 *   viewer@demo.com  / password: Viewer123!  (role: viewer)
 *
 * Plus ~60 financial records spread across the last 12 months.
 */

const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const Datastore = require("nedb-promises");

const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = {
  users: Datastore.create({ filename: path.join(dataDir, "users.db"), autoload: true }),
  records: Datastore.create({ filename: path.join(dataDir, "records.db"), autoload: true }),
};

const SALT_ROUNDS = 10;

const CATEGORIES = [
  "salary", "freelance", "investment", "rent", "utilities",
  "groceries", "transport", "healthcare", "entertainment", "education", "other",
];

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDateInLastMonths(months) {
  const now = new Date();
  const past = new Date(now - months * 30 * 24 * 60 * 60 * 1000);
  const ts = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(ts).toISOString().slice(0, 10);
}

async function clearCollections() {
  await db.users.remove({}, { multi: true });
  await db.records.remove({}, { multi: true });
  console.log("✓ Cleared existing data");
}

async function seedUsers() {
  const users = [
    { name: "Alice Admin", email: "admin@demo.com", password: "Admin123!", role: "admin" },
    { name: "Bob Analyst", email: "analyst@demo.com", password: "Analyst123!", role: "analyst" },
    { name: "Victor Viewer", email: "viewer@demo.com", password: "Viewer123!", role: "viewer" },
  ];

  const created = [];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const doc = await db.users.insert({
      _id: uuidv4(),
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created.push(doc);
    console.log(`✓ Created user: ${u.email}  [${u.role}]  password: ${u.password}`);
  }
  return created;
}

async function seedRecords(adminId) {
  const records = [];

  // Salary income — monthly for last 12 months
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    records.push({
      amount: randomBetween(4500, 5500),
      type: "income",
      category: "salary",
      date: d.toISOString().slice(0, 10),
      notes: "Monthly salary",
    });
  }

  // Freelance income
  for (let i = 0; i < 8; i++) {
    records.push({
      amount: randomBetween(500, 2000),
      type: "income",
      category: "freelance",
      date: randomDateInLastMonths(12),
      notes: "Freelance project payment",
    });
  }

  // Investment returns
  for (let i = 0; i < 4; i++) {
    records.push({
      amount: randomBetween(100, 800),
      type: "income",
      category: "investment",
      date: randomDateInLastMonths(12),
      notes: "Dividend / return",
    });
  }

  // Regular expenses
  const expenseTemplates = [
    { category: "rent", count: 12, min: 1200, max: 1200, notes: "Monthly rent" },
    { category: "utilities", count: 12, min: 80, max: 160, notes: "Electricity & water" },
    { category: "groceries", count: 24, min: 60, max: 180, notes: "Weekly groceries" },
    { category: "transport", count: 20, min: 20, max: 100, notes: "Commute / fuel" },
    { category: "healthcare", count: 4, min: 50, max: 400, notes: "Medical / pharmacy" },
    { category: "entertainment", count: 10, min: 15, max: 120, notes: "Dining out / streaming" },
    { category: "education", count: 3, min: 100, max: 500, notes: "Online course / books" },
    { category: "other", count: 5, min: 20, max: 200, notes: "Miscellaneous" },
  ];

  for (const tmpl of expenseTemplates) {
    for (let i = 0; i < tmpl.count; i++) {
      records.push({
        amount: randomBetween(tmpl.min, tmpl.max),
        type: "expense",
        category: tmpl.category,
        date: randomDateInLastMonths(12),
        notes: tmpl.notes,
      });
    }
  }

  // Insert all
  for (const r of records) {
    await db.records.insert({
      _id: uuidv4(),
      ...r,
      createdBy: adminId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  console.log(`✓ Inserted ${records.length} financial records`);
}

async function main() {
  console.log("\n📦  Seeding Finance Backend database...\n");
  await clearCollections();
  const users = await seedUsers();
  const admin = users.find((u) => u.role === "admin");
  await seedRecords(admin._id);
  console.log("\n✅  Seed complete!\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
