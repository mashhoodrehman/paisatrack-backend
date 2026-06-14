const express = require("express");

const controller = require("../controllers/groupController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createGroup);
router.get("/", controller.getGroups);
router.get("/:id", controller.getGroupDetail);
router.post("/:id/members", controller.addMembers);
router.post("/:id/settle", controller.settleUp);
router.delete("/:id", controller.deleteGroup);

module.exports = router;
