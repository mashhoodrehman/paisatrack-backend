const express = require("express");

const controller = require("../controllers/borrowLendController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/", controller.createRecord);
router.get("/", controller.getRecords);

module.exports = router;
