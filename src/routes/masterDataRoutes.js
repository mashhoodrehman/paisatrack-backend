const express = require("express");

const controller = require("../controllers/masterDataController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/categories", protect, controller.getCategories);
router.get("/payment-methods", protect, controller.getPaymentMethods);

module.exports = router;
