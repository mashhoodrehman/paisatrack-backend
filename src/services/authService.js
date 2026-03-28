const jwt = require("jsonwebtoken");

const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const { sendOtpMail } = require("./mailService");

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

async function requestOtp(phoneNumber, email) {
  const code = "123456";

  await pool.query(
    `INSERT INTO otp_requests (phone_number, otp_code, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [phoneNumber, code]
  );

  if (email) {
    await sendOtpMail(email, code);
  }

  return {
    phoneNumber,
    email: email || null,
    otpCode: code,
    expiresInMinutes: 10
  };
}

async function verifyOtp(phoneNumber, otpCode) {
  const [otpRows] = await pool.query(
    `SELECT id
     FROM otp_requests
     WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [phoneNumber, otpCode]
  );

  if (!otpRows.length) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const [userRows] = await pool.query(
    "SELECT * FROM users WHERE phone_number = ? LIMIT 1",
    [phoneNumber]
  );

  let user = userRows[0];

  if (!user) {
    const [result] = await pool.query(
      `INSERT INTO users (full_name, phone_number, currency_code)
       VALUES (?, ?, ?)`,
      ["PaisaTrack User", phoneNumber, "PKR"]
    );

    const [newUserRows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId
    ]);
    user = newUserRows[0];
  }

  return {
    token: createToken(user.id),
    user
  };
}

async function loginWithGoogle(payload) {
  const { email, fullName } = payload;
  if (!email) {
    throw new ApiError(400, "Email is required for Google login");
  }

  const [existingRows] = await pool.query("SELECT * FROM users WHERE email = ?", [
    email
  ]);

  let user = existingRows[0];
  if (!user) {
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, currency_code)
       VALUES (?, ?, ?)`,
      [fullName || "Google User", email, "PKR"]
    );
    const [newUserRows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId
    ]);
    user = newUserRows[0];
  }

  return {
    token: createToken(user.id),
    user
  };
}

module.exports = {
  requestOtp,
  verifyOtp,
  loginWithGoogle
};
