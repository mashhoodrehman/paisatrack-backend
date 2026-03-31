const express = require("express");

const controller = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.put("/setup", protect, controller.updateSetup);
router.get("/settings", protect, controller.getSettings);
router.put("/settings", protect, controller.updateSettings);
router.get("/search", protect, controller.searchUsers);
router.get("/friends", protect, controller.getFriends);
router.post("/friends/requests", protect, controller.sendFriendRequest);
router.post("/friends/requests/:id/accept", protect, controller.acceptFriendRequest);
router.get("/income", protect, controller.getIncomeEntries);
router.post("/income", protect, controller.addIncomeEntry);
router.get("/reminders", protect, controller.getReminders);

module.exports = router;
