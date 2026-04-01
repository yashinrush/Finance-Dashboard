const express = require("express");
const router = express.Router();
const dashboardService = require("../services/dashboardService");
const { authenticate, authorize, requireActive } = require("../middleware/auth");
const { PERMISSIONS } = require("../utils/roles");

router.use(authenticate, requireActive);

/**
 * GET /dashboard/overview
 * Viewer / Analyst / Admin — total income, expenses, net balance, record count.
 */
router.get("/overview", authorize(PERMISSIONS.VIEW_SUMMARY), async (req, res, next) => {
  try {
    const data = await dashboardService.getOverview();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard/categories
 * Viewer / Analyst / Admin — totals broken down by category.
 */
router.get("/categories", authorize(PERMISSIONS.VIEW_SUMMARY), async (req, res, next) => {
  try {
    const data = await dashboardService.getCategoryBreakdown();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard/trends/monthly
 * Viewer / Analyst / Admin — monthly income vs expense over last N months.
 * Query: months (default 12)
 */
router.get("/trends/monthly", authorize(PERMISSIONS.VIEW_SUMMARY), async (req, res, next) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months) || 12, 1), 36);
    const data = await dashboardService.getMonthlyTrends(months);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard/trends/weekly
 * Viewer / Analyst / Admin — weekly trends for last N weeks.
 * Query: weeks (default 8)
 */
router.get("/trends/weekly", authorize(PERMISSIONS.VIEW_SUMMARY), async (req, res, next) => {
  try {
    const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 8, 1), 52);
    const data = await dashboardService.getWeeklyTrends(weeks);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard/recent
 * Viewer / Analyst / Admin — most recent financial activity.
 * Query: limit (default 10, max 50)
 */
router.get("/recent", authorize(PERMISSIONS.VIEW_SUMMARY), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const data = await dashboardService.getRecentActivity(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard/insights
 * Analyst / Admin only — deeper analytics: top spend categories, ratio, trends.
 */
router.get("/insights", authorize(PERMISSIONS.VIEW_INSIGHTS), async (req, res, next) => {
  try {
    const data = await dashboardService.getInsights();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
