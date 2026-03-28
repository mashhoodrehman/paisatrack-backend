const express = require("express");

const controller = require("../controllers/committeeController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createCommittee);
router.get("/", controller.getCommittees);
router.post("/:committeeId/installments", controller.createInstallment);

module.exports = router;
