const express = require("express");

const controller = require("../controllers/recurringController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createRecurringPayment);
router.get("/", controller.getRecurringPayments);
router.get("/:id/history", controller.getRecurringPaymentHistory);
router.delete("/:id", controller.deleteRecurringPayment);

module.exports = router;
