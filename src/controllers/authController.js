const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");

const requestOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestOtp(req.body.phoneNumber, req.body.email);
  res.status(200).json({ success: true, data });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyOtp(req.body.phoneNumber, req.body.otpCode);
  res.status(200).json({ success: true, data });
});

const googleLogin = asyncHandler(async (req, res) => {
  const data = await authService.loginWithGoogle(req.body);
  res.status(200).json({ success: true, data });
});

module.exports = {
  requestOtp,
  verifyOtp,
  googleLogin
};
