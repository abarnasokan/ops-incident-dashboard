const router = require("express").Router();
const validate = require("../validation");
const c = require("../controllers/userController");
router.get("/", c.getUsers);
router.get("/:id", validate.id, c.getUserById);
router.post("/", validate.register, c.createUser);
module.exports = router;
