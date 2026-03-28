const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/committeeService");

const createCommittee = asyncHandler(async (req, res) => {
  const data = await service.createCommittee(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const createInstallment = asyncHandler(async (req, res) => {
  const data = await service.createInstallment(req.user.id, req.params.committeeId, req.body);
  res.status(201).json({ success: true, data });
});

const getCommittees = asyncHandler(async (req, res) => {
  const data = await service.getCommittees(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  createCommittee,
  createInstallment,
  getCommittees
};
