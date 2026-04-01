/**
 * Centralized error handler.
 * Converts known error shapes to structured JSON responses.
 */
function errorHandler(err, req, res, next) {
  // NeDB duplicate key error
  if (err.errorType === "uniqueViolated") {
    return res.status(409).json({ error: "A record with that value already exists" });
  }

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error("[ERROR]", err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
