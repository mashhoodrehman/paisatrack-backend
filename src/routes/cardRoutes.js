const express = require("express");

const controller = require("../controllers/cardController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createCard);
router.get("/", controller.getCards);
router.get("/:id", controller.getCardDetail);
router.post("/:id/payments", controller.payBill);

module.exports = router;
