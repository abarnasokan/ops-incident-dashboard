const express = require("express");
const router = express.Router();
const validateIncident = require("../middleware/incidentValidation");
const validateId = require("../middleware/idValidation");

const {
    getIncidents,
    getIncidentById,
    createIncident,
    updateIncident,
    deleteIncident,
} = require("../controllers/incidentController");

router.post(
    "/",
    validateIncident,
    createIncident
);

router.get("/", getIncidents);
router.get("/:id", validateId, getIncidentById);
router.put("/:id", validateId, updateIncident);
router.delete("/:id", validateId, deleteIncident);

module.exports = router;
