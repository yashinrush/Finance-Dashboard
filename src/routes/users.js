const express = require("express");
const router = express.Router();
const userService = require("../services/userService");
const { authenticate, authorize, requireActive } = require("../middleware/auth");
const { PERMISSIONS } = require("../utils/roles");
const { updateUserSchema, validate } = require("../utils/validation");

// All user-management routes require authentication + active status
router.use(authenticate, requireActive);

/**
 * GET /users
 * Admin only — list all users with pagination.
 * Query: page, limit
 */
router.get("/", authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await userService.listUsers({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/:id
 * Admin only — get a specific user by ID.
 */
router.get("/:id", authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /users/:id
 * Admin only — update name, role, or status of a user.
 */
router.patch(
  "/:id",
  authorize(PERMISSIONS.MANAGE_USERS),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /users/:id
 * Admin only — soft-deletes (deactivates) the user.
 * Admins cannot deactivate themselves.
 */
router.delete("/:id", authorize(PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }
    const result = await userService.deleteUser(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
