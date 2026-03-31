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

const searchUsers = asyncHandler(async (req, res) => {
  const data = await userService.searchUsers(req.user.id, req.query.q);
  res.json({ success: true, data });
});

const sendFriendRequest = asyncHandler(async (req, res) => {
  const data = await userService.sendFriendRequest(req.user.id, req.body.friendUserId);
  res.status(201).json({ success: true, data });
});

const acceptFriendRequest = asyncHandler(async (req, res) => {
  const data = await userService.acceptFriendRequest(req.user.id, req.params.id);
  res.json({ success: true, data });
});

const getFriends = asyncHandler(async (req, res) => {
  const data = await userService.getFriends(req.user.id);
  res.json({ success: true, data });
});

const addIncomeEntry = asyncHandler(async (req, res) => {
  const data = await userService.addIncomeEntry(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getIncomeEntries = asyncHandler(async (req, res) => {
  const data = await userService.getIncomeEntries(req.user.id);
  res.json({ success: true, data });
});

const getReminders = asyncHandler(async (req, res) => {
  const data = await userService.getReminders(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  updateSetup,
  getSettings,
  updateSettings,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  getFriends,
  addIncomeEntry,
  getIncomeEntries,
  getReminders,
};
