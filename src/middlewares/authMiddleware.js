const jwt = require("jsonwebtoken");

const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Authorization token is required");
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const [rows] = await pool.query(
    "SELECT id, full_name, phone_number, email, monthly_income, currency_code FROM users WHERE id = ?",
    [decoded.userId]
  );

  if (!rows.length) {
    throw new ApiError(401, "User not found");
  }

  req.user = rows[0];
  next();
});

module.exports = {
  protect
};
