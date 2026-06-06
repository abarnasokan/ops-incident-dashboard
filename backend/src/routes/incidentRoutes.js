const express = require("express");
const router = express.Router();
const validateIncident = require("../middleware/incidentValidation");

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
router.get("/:id", getIncidentById);
router.put("/:id", updateIncident);
router.delete("/:id", deleteIncident);

module.exports = router;