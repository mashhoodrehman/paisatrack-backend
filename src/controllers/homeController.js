const asyncHandler = require("../utils/asyncHandler");
const homeService = require("../services/homeService");

const getDashboard = asyncHandler(async (req, res) => {
  const data = await homeService.getDashboard(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  getDashboard
};
