const asyncHandler = require("../utils/asyncHandler");
const expenseService = require("../services/expenseService");

const createExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.createExpense(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getExpenses = asyncHandler(async (req, res) => {
  const data = await expenseService.getExpenses(req.user.id, req.query);
  res.json({ success: true, data });
});

const getSplitSettlements = asyncHandler(async (req, res) => {
  const data = await expenseService.getSplitSettlements(req.params.id);
  res.json({ success: true, data });
});

module.exports = {
  createExpense,
  getExpenses,
  getSplitSettlements
};
