const express = require("express");

const controller = require("../controllers/homeController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/dashboard", protect, controller.getDashboard);

module.exports = router;
