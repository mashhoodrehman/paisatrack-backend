const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/borrowLendService");

const createRecord = asyncHandler(async (req, res) => {
  const data = await service.createRecord(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getRecords = asyncHandler(async (req, res) => {
  const data = await service.getRecords(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  createRecord,
  getRecords
};
