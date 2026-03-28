const express = require("express");

const controller = require("../controllers/ledgerController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/vendors", controller.createVendor);
router.get("/vendors", controller.getVendors);
router.post("/vendors/:vendorId/entries", controller.createEntry);
router.get("/vendors/:vendorId/entries", controller.getVendorEntries);

module.exports = router;
