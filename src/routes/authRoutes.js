const express = require("express");

const controller = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/request-otp", controller.requestOtp);
router.post("/verify-otp", controller.verifyOtp);

router.post("/request-email-otp", controller.requestEmailOtp);
router.post("/verify-email-otp", controller.verifyEmailOtp);
router.post("/login", controller.login);
router.get("/me", protect, controller.getMe);

router.post("/google", controller.googleLogin);

module.exports = router;
