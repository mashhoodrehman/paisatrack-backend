const express = require("express");

const controller = require("../controllers/authController");

const router = express.Router();

router.post("/request-otp", controller.requestOtp);
router.post("/verify-otp", controller.verifyOtp);
router.post("/google", controller.googleLogin);

module.exports = router;
