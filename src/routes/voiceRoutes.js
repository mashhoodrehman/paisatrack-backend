const express = require("express");

const controller = require("../controllers/voiceController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/parse", controller.handleVoiceCommand);

module.exports = router;
