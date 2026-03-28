const asyncHandler = require("../utils/asyncHandler");
const groupService = require("../services/groupService");

const createGroup = asyncHandler(async (req, res) => {
  const data = await groupService.createGroup(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getGroups = asyncHandler(async (req, res) => {
  const data = await groupService.getGroups(req.user.id);
  res.json({ success: true, data });
});

const getGroupExpenses = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupExpenses(req.params.id);
  res.json({ success: true, data });
});

const getGroupSettlement = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupSettlement(req.params.id);
  res.json({ success: true, data });
});

module.exports = {
  createGroup,
  getGroups,
  getGroupExpenses,
  getGroupSettlement
};
