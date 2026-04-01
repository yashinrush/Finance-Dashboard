const { z } = require("zod");

// ─── Auth ─────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["viewer", "analyst", "admin"]).optional().default("viewer"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Users ────────────────────────────────────────────────────────────────────

const updateUserSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["viewer", "analyst", "admin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

// ─── Financial Records ────────────────────────────────────────────────────────

const CATEGORIES = [
  "salary", "freelance", "investment", "rent", "utilities",
  "groceries", "transport", "healthcare", "entertainment", "education", "other",
];

const createRecordSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  category: z.enum(CATEGORIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  notes: z.string().max(500).optional().default(""),
});

const updateRecordSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.enum(CATEGORIES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

const recordFilterSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  category: z.enum(CATEGORIES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(["date", "amount", "createdAt"]).optional().default("date"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

// ─── Validation Middleware Factory ────────────────────────────────────────────

/**
 * Returns express middleware that validates req.body against a Zod schema.
 * On failure it responds 422 with structured field errors.
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = (result.error?.errors ?? []).map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(422).json({ error: "Validation failed", details: errors });
    }
    req[source] = result.data; // replace with coerced/defaulted data
    next();
  };
}

module.exports = {
  registerSchema, loginSchema, updateUserSchema,
  createRecordSchema, updateRecordSchema, recordFilterSchema,
  validate, CATEGORIES,
};
