const express = require("express");
const router = express.Router();
const recordService = require("../services/recordService");
const { authenticate, authorize, requireActive } = require("../middleware/auth");
const { PERMISSIONS } = require("../utils/roles");
const {
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
  validate,
} = require("../utils/validation");

router.use(authenticate, requireActive);

/**
 * GET /records
 * Viewer / Analyst / Admin — list records with filtering & pagination.
 * Query: type, category, from, to, page, limit, sortBy, order
 */
router.get(
  "/",
  authorize(PERMISSIONS.VIEW_RECORDS),
  validate(recordFilterSchema, "query"),
  async (req, res, next) => {
    try {
      const result = await recordService.listRecords(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /records/:id
 * Viewer / Analyst / Admin — get single record by ID.
 */
router.get("/:id", authorize(PERMISSIONS.VIEW_RECORDS), async (req, res, next) => {
  try {
    const record = await recordService.getRecordById(req.params.id);
    if (record.deleted) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /records
 * Admin only — create a new financial record.
 */
router.post(
  "/",
  authorize(PERMISSIONS.CREATE_RECORD),
  validate(createRecordSchema),
  async (req, res, next) => {
    try {
      const record = await recordService.createRecord(req.body, req.user.id);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /records/:id
 * Admin only — update an existing record.
 */
router.patch(
  "/:id",
  authorize(PERMISSIONS.UPDATE_RECORD),
  validate(updateRecordSchema),
  async (req, res, next) => {
    try {
      const record = await recordService.updateRecord(req.params.id, req.body);
      res.json(record);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /records/:id
 * Admin only — soft-delete a record.
 */
router.delete("/:id", authorize(PERMISSIONS.DELETE_RECORD), async (req, res, next) => {
  try {
    const result = await recordService.deleteRecord(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
