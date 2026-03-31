const express = require("express");

const controller = require("../controllers/expenseController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createExpense);
router.get("/", controller.getExpenses);
router.get("/:id/settlements", controller.getSplitSettlements);
router.post("/:id/settle", controller.settleSplitExpense);

module.exports = router;
