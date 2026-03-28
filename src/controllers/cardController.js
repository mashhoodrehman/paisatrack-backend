const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/cardService");

const createCard = asyncHandler(async (req, res) => {
  const data = await service.createCard(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const getCards = asyncHandler(async (req, res) => {
  const data = await service.getCards(req.user.id);
  res.json({ success: true, data });
});

const getCardDetail = asyncHandler(async (req, res) => {
  const data = await service.getCardDetail(req.user.id, req.params.id);
  res.json({ success: true, data });
});

const payBill = asyncHandler(async (req, res) => {
  const data = await service.payBill(req.user.id, req.params.id, req.body);
  res.json({ success: true, data });
});

module.exports = {
  createCard,
  getCards,
  getCardDetail,
  payBill
};
