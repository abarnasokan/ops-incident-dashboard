const { body, validationResult } = require("express-validator");

const validateIncident = [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("severity")
        .isIn(["SEV1", "SEV2", "SEV3", "SEV4"])
        .withMessage("Severity must be one of: SEV1, SEV2, SEV3, SEV4"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }
        next();
    },
];

module.exports = validateIncident;