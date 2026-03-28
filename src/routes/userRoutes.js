const express = require("express");

const controller = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.put("/setup", protect, controller.updateSetup);
router.get("/settings", protect, controller.getSettings);
router.put("/settings", protect, controller.updateSettings);

module.exports = router;
