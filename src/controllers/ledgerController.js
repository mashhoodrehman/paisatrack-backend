const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/ledgerService");

const createVendor = asyncHandler(async (req, res) => {
  const data = await service.createVendor(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const createEntry = asyncHandler(async (req, res) => {
  const data = await service.createEntry(req.user.id, req.params.vendorId, req.body);
  res.status(201).json({ success: true, data });
});

const getVendors = asyncHandler(async (req, res) => {
  const data = await service.getVendors(req.user.id);
  res.json({ success: true, data });
});

const getVendorEntries = asyncHandler(async (req, res) => {
  const data = await service.getVendorEntries(req.params.vendorId);
  res.json({ success: true, data });
});

module.exports = {
  createVendor,
  createEntry,
  getVendors,
  getVendorEntries
};
