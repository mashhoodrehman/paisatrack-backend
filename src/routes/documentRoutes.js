const express = require("express");

const controller = require("../controllers/documentController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/scan", controller.scanDocument);

module.exports = router;
