const express = require("express");

const controller = require("../controllers/groupController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createGroup);
router.get("/", controller.getGroups);
router.get("/:id/expenses", controller.getGroupExpenses);
router.get("/:id/settlement", controller.getGroupSettlement);

module.exports = router;
