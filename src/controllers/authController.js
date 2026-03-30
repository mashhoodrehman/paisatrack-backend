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

const requestEmailOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestEmailOtp(req.body);
  res.status(200).json({ success: true, data });
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyEmailOtp(req.body.email, req.body.otpCode);
  res.status(200).json({ success: true, data });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body.username, req.body.password);
  res.status(200).json({ success: true, data });
});

const getMe = asyncHandler(async (req, res) => {
  // req.user is already populated by protect middleware
  const data = await authService.getUserProfile(req.user.id);
  res.status(200).json({ success: true, data });
});

const googleLogin = asyncHandler(async (req, res) => {
  const data = await authService.loginWithGoogle(req.body);
  res.status(200).json({ success: true, data });
});

module.exports = {
  requestOtp,
  verifyOtp,
  requestEmailOtp,
  verifyEmailOtp,
  login,
  getMe,
  googleLogin
};
