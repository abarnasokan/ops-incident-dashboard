const pool = require("../config/db");

// GET all incidents
const getIncidents = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM incidents ORDER BY created_at DESC"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET one incident by ID
const getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM incidents WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Incident not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching incident:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// CREATE incident
const createIncident = async (req, res) => {
    try {
        console.log("POST /api/incidents body:", req.body);

        if (!req.body) {
            return res.status(400).json({
                message: "Request body is missing. Ensure you are sending JSON and the 'Content-Type: application/json' header is set.",
            });
        }

        const { title, description, severity, category, assigned_to } = req.body;

        if (!title || !description || !severity) {
            return res.status(400).json({
                message: "title, description, and severity are required",
            });
        }

        const result = await pool.query(
            `INSERT INTO incidents 
       (title, description, severity, category, assigned_to)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [title, description, severity, category, assigned_to]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating incident:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// UPDATE incident
const updateIncident = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.body) {
            return res.status(400).json({
                message: "Request body is missing. Ensure you are sending JSON and the 'Content-Type: application/json' header is set.",
            });
        }

        const { title, description, severity, status, category, assigned_to } = req.body;

        if (!title || !description || !severity || !status) {
            return res.status(400).json({
                message: "title, description, severity, and status are required",
            });
        }

        const result = await pool.query(
            `UPDATE incidents
       SET title = $1,
           description = $2,
           severity = $3,
           status = $4::VARCHAR,
           category = $5,
           assigned_to = $6,
           updated_at = CURRENT_TIMESTAMP,
           resolved_at = CASE 
             WHEN $4::VARCHAR = 'Resolved' THEN CURRENT_TIMESTAMP 
             ELSE resolved_at 
           END
       WHERE id = $7
       RETURNING *`,
            [title, description, severity, status, category, assigned_to, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Incident not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating incident:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE incident
const deleteIncident = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM incidents WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Incident not found" });
        }

        res.json({ message: "Incident deleted successfully" });
    } catch (error) {
        console.error("Error deleting incident:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getIncidents,
    getIncidentById,
    createIncident,
    updateIncident,
    deleteIncident,
};