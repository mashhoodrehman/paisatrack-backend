const asyncHandler = require("../utils/asyncHandler");
const masterDataService = require("../services/masterDataService");

const getCategories = asyncHandler(async (_req, res) => {
  const data = await masterDataService.getCategories();
  res.json({ success: true, data });
});

const getPaymentMethods = asyncHandler(async (_req, res) => {
  const data = await masterDataService.getPaymentMethods();
  res.json({ success: true, data });
});

module.exports = {
  getCategories,
  getPaymentMethods
};
