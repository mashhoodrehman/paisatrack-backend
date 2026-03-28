const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/userService");

const updateSetup = asyncHandler(async (req, res) => {
  const data = await userService.updateSetup(req.user.id, req.body);
  res.json({ success: true, data });
});

const getSettings = asyncHandler(async (req, res) => {
  const data = await userService.getSettings(req.user.id);
  res.json({ success: true, data });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await userService.updateSettings(req.user.id, req.body);
  res.json({ success: true, data });
});

module.exports = {
  updateSetup,
  getSettings,
  updateSettings
};
