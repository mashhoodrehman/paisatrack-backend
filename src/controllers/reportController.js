const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/reportService");

const getReports = asyncHandler(async (req, res) => {
  const data = await service.getReports(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  getReports
};
