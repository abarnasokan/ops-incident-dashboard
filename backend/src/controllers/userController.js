const pool = require("../config/db");

// GET all users
const getUsers = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM users ORDER BY id"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET user by ID
const getUserById = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// CREATE user
const createUser = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({
                message: "Request body is missing. Ensure you are sending JSON and the 'Content-Type: application/json' header is set.",
            });
        }

        const { name, email, role } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({
                message: "name, email, and role are required",
            });
        }

        const result = await pool.query(
            `INSERT INTO users (name, email, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [name, email, role]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
};