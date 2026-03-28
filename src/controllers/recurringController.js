const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/recurringService");

const createRecurringPayment = asyncHandler(async (req, res) => {
  const data = await service.createRecurringPayment(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getRecurringPayments = asyncHandler(async (req, res) => {
  const data = await service.getRecurringPayments(req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  createRecurringPayment,
  getRecurringPayments
};
