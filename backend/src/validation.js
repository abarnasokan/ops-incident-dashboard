const { body, param, query, validationResult } = require("express-validator");
const statuses = ["Open", "In Progress", "Mitigated", "Resolved"];
const severities = ["SEV1", "SEV2", "SEV3", "SEV4"];
const finish = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({
      message: "Check the submitted fields.",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  next();
};
const text = (name, max, optional = false) => {
  let rule = body(name);
  if (optional) rule = rule.optional();
  return rule
    .isString()
    .bail()
    .trim()
    .isLength({ min: 1, max })
    .withMessage(`${name} must contain 1–${max} characters`);
};
const incident = (partial = false) => [
  text("title", 160, partial),
  text("description", 10000, partial),
  (partial ? body("severity").optional() : body("severity")).isIn(severities),
  body("status").optional().isIn(statuses),
  text("category", 40, true),
  text("service", 80, true),
  body("assigned_to")
    .optional({ nullable: true })
    .isInt({ min: 1, max: 2147483647 }),
  ...(partial
    ? [
        body("version")
          .isInt({ min: 1 })
          .withMessage("version is required to prevent lost updates"),
      ]
    : []),
  finish,
];
const id = [param("id").isInt({ min: 1, max: 2147483647 }), finish];
const credentials = [
  body("email")
    .isString()
    .bail()
    .trim()
    .isEmail()
    .isLength({ max: 254 })
    .toLowerCase(),
  body("password").isString().bail().isLength({ min: 10, max: 128 }),
  finish,
];
const register = [text("name", 100), ...credentials];
const filters = [
  query("status").optional().isIn(statuses),
  query("severity").optional().isIn(severities),
  query("q").optional().isString().isLength({ max: 160 }),
  query("assigned_to").optional().isInt({ min: 1 }),
  query("page").optional().isInt({ min: 1, max: 100000 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  finish,
];
module.exports = {
  id,
  credentials,
  register,
  incident,
  filters,
  comment: [text("body", 4000), finish],
  statuses,
  severities,
};
