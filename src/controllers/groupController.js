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

const getGroupDetail = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupDetail(req.user.id, req.params.id);
  res.json({ success: true, data });
});

const addMembers = asyncHandler(async (req, res) => {
  const data = await groupService.addMembers(req.user.id, req.params.id, req.body);
  res.status(201).json({ success: true, data });
});

const settleUp = asyncHandler(async (req, res) => {
  const data = await groupService.settleUp(req.user.id, req.params.id, req.body);
  res.status(201).json({ success: true, data });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const data = await groupService.deleteGroup(req.user.id, req.params.id);
  res.json({ success: true, data });
});

module.exports = {
  createGroup,
  getGroups,
  getGroupDetail,
  addMembers,
  settleUp,
  deleteGroup,
};
