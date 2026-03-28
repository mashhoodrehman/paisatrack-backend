const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/voiceService");

const handleVoiceCommand = asyncHandler(async (req, res) => {
  const data = await service.handleVoiceCommand(req.user.id, req.body.command);
  res.status(201).json({ success: true, data });
});

module.exports = {
  handleVoiceCommand
};
