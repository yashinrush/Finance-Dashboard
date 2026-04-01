const jwt = require("jsonwebtoken");
const { can } = require("../utils/roles");

const JWT_SECRET = process.env.JWT_SECRET || "finance-dashboard-secret-dev";

/**
 * Verifies the Bearer token and attaches `req.user` with id, email, role.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
}

/**
 * Factory: returns middleware that checks whether req.user's role
 * has the given permission. Must be used after `authenticate`.
 */
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    if (!can(req.user.role, permission)) {
      return res.status(403).json({
        error: `Forbidden — your role '${req.user.role}' lacks '${permission}' permission`,
      });
    }
    next();
  };
}

/**
 * Checks that req.user has one of the supplied roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden — requires one of roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Ensures the user account is active. Attach after authenticate.
 */
function requireActive(req, res, next) {
  if (req.user && req.user.status === "inactive") {
    return res.status(403).json({ error: "Account is inactive" });
  }
  next();
}

module.exports = { authenticate, authorize, requireRole, requireActive, JWT_SECRET };
