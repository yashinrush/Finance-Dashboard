const db = require("../db");

/**
 * Returns high-level totals: total income, expenses, net balance.
 */
async function getOverview() {
  const records = await db.records.find({ deleted: { $ne: true } });

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const r of records) {
    if (r.type === "income") totalIncome += r.amount;
    else if (r.type === "expense") totalExpenses += r.amount;
  }

  return {
    totalIncome: round(totalIncome),
    totalExpenses: round(totalExpenses),
    netBalance: round(totalIncome - totalExpenses),
    recordCount: records.length,
  };
}

/**
 * Returns totals broken down by category.
 */
async function getCategoryBreakdown() {
  const records = await db.records.find({ deleted: { $ne: true } });

  const breakdown = {};
  for (const r of records) {
    if (!breakdown[r.category]) breakdown[r.category] = { income: 0, expense: 0 };
    breakdown[r.category][r.type] += r.amount;
  }

  return Object.entries(breakdown).map(([category, totals]) => ({
    category,
    income: round(totals.income),
    expense: round(totals.expense),
    net: round(totals.income - totals.expense),
  }));
}

/**
 * Monthly trends for the last N months (default 12).
 */
async function getMonthlyTrends(months = 12) {
  const records = await db.records.find({ deleted: { $ne: true } }).sort({ date: -1 });

  // Determine cutoff
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = records.filter((r) => r.date >= cutoffStr);

  const monthly = {};
  for (const r of filtered) {
    const month = r.date.slice(0, 7); // "YYYY-MM"
    if (!monthly[month]) monthly[month] = { month, income: 0, expense: 0 };
    monthly[month][r.type] += r.amount;
  }

  return Object.values(monthly)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((m) => ({ ...m, income: round(m.income), expense: round(m.expense), net: round(m.income - m.expense) }));
}

/**
 * Weekly trends for the last N weeks (default 8).
 */
async function getWeeklyTrends(weeks = 8) {
  const records = await db.records.find({ deleted: { $ne: true } }).sort({ date: -1 });

  const now = new Date();
  const cutoff = new Date(now - weeks * 7 * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = records.filter((r) => r.date >= cutoffStr);

  const weekly = {};
  for (const r of filtered) {
    const weekStart = getWeekStart(r.date);
    if (!weekly[weekStart]) weekly[weekStart] = { week: weekStart, income: 0, expense: 0 };
    weekly[weekStart][r.type] += r.amount;
  }

  return Object.values(weekly)
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    .map((w) => ({ ...w, income: round(w.income), expense: round(w.expense), net: round(w.income - w.expense) }));
}

/**
 * Returns the N most recent non-deleted records.
 */
async function getRecentActivity(limit = 10) {
  const records = await db.records
    .find({ deleted: { $ne: true } })
    .sort({ date: -1, createdAt: -1 });
  return records.slice(0, limit);
}

/**
 * Analyst-only: deeper insights — top categories by spend, income vs expense ratio.
 */
async function getInsights() {
  const [overview, categories, monthly] = await Promise.all([
    getOverview(),
    getCategoryBreakdown(),
    getMonthlyTrends(3),
  ]);

  const topExpenseCategories = [...categories]
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 5);

  const topIncomeCategories = [...categories]
    .sort((a, b) => b.income - a.income)
    .slice(0, 5);

  const ratio =
    overview.totalIncome > 0
      ? round((overview.totalExpenses / overview.totalIncome) * 100)
      : null;

  return {
    expenseToIncomeRatio: ratio !== null ? `${ratio}%` : "N/A",
    topExpenseCategories,
    topIncomeCategories,
    last3MonthsTrend: monthly,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n) {
  return Math.round(n * 100) / 100;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

module.exports = {
  getOverview,
  getCategoryBreakdown,
  getMonthlyTrends,
  getWeeklyTrends,
  getRecentActivity,
  getInsights,
};
