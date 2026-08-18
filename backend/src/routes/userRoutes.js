const express = require("express");
const router = express.Router();
const validateId = require("../middleware/idValidation");

const {
    getUsers,
    getUserById,
    createUser,
} = require("../controllers/userController");

router.get("/", getUsers);
router.get("/:id", validateId, getUserById);
router.post("/", createUser);

module.exports = router;
