const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/documentService");

const scanDocument = asyncHandler(async (req, res) => {
  const data = await service.scanDocument(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

module.exports = {
  scanDocument
};
