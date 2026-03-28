const express = require("express");

const controller = require("../controllers/reportController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", controller.getReports);

module.exports = router;
