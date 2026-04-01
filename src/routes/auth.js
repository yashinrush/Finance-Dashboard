const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const { registerSchema, loginSchema, validate } = require("../utils/validation");
const { authenticate } = require("../middleware/auth");

/**
 * POST /auth/register
 * Public. Creates a new user. By default assigns 'viewer' role.
 * Only admins should be able to create admin users — enforced in the service layer via the seed flow.
 * In a full production setup, you'd restrict role assignment to admins.
 */
router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * Public. Returns a signed JWT on success.
 */
router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/me
 * Returns the authenticated user's profile (from JWT payload).
 */
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
