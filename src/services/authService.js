const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const { sendOtpMail } = require("./mailService");

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function sanitizeUser(user) {
  const { password, email_verification_code, email_verification_expires_at, ...safeUser } = user;
  return safeUser;
}

// Request OTP via phone (existing flow)
async function requestOtp(phoneNumber, email) {
  const code = "123456"; // Mock OTP

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

// Verify OTP via phone (existing flow)
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
    token: createToken(user),
    user: sanitizeUser(user)
  };
}

// Request OTP via Email (New flow for Mobile App)
async function requestEmailOtp(payload) {
  const { fullName, username, email, password } = payload;
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const hashedPassword = await bcrypt.hash(password, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Check if user already exists and is verified
  const [existingUsers] = await pool.query(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [email, username]
  );

  const existingUser = existingUsers.find(u => u.email === email || u.username === username);

  if (existingUser && existingUser.email_verified_at) {
    if (existingUser.email === email) {
      throw new ApiError(409, "An account with this email already exists");
    }
    throw new ApiError(409, "This username is already taken");
  }

  if (existingUser) {
    await pool.query(
      `UPDATE users
       SET full_name = ?, username = ?, password = ?, email_verification_code = ?, email_verification_expires_at = ?, email_verified_at = NULL
       WHERE id = ?`,
      [fullName, username, hashedPassword, otpCode, expiresAt, existingUser.id]
    );
  } else {
    await pool.query(
      `INSERT INTO users (full_name, username, email, password, email_verification_code, email_verification_expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, username, email, hashedPassword, otpCode, expiresAt]
    );
  }

  console.log(`Email OTP for ${email}: ${otpCode}`);
  await sendOtpMail(email, otpCode);

  return {
    email,
    expiresInMinutes: 10,
    otpCode // Providing for dev convenience as requested in mobile app
  };
}

// Verify Email OTP (New flow for Mobile App)
async function verifyEmailOtp(email, otpCode) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  const user = rows[0];
  if (!user) throw new ApiError(404, "User not found");

  if (!user.email_verification_code || user.email_verification_code !== otpCode) {
    throw new ApiError(401, "Invalid verification code");
  }

  if (new Date(user.email_verification_expires_at) < new Date()) {
    throw new ApiError(401, "Verification code has expired");
  }

  await pool.query(
    `UPDATE users
     SET email_verified_at = NOW(), email_verification_code = NULL, email_verification_expires_at = NULL
     WHERE id = ?`,
    [user.id]
  );

  const [updatedUserRows] = await pool.query("SELECT * FROM users WHERE id = ?", [user.id]);
  const updatedUser = updatedUserRows[0];

  return {
    token: createToken(updatedUser),
    user: sanitizeUser(updatedUser)
  };
}

// Login via Username/Password
async function login(username, password) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [username]
  );

  const user = rows[0];
  if (!user) throw new ApiError(404, "User not found");

  if (!user.email_verified_at) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
}

async function getUserProfile(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE id = ?",
    [userId]
  );

  if (!rows.length) throw new ApiError(404, "User not found");

  return sanitizeUser(rows[0]);
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
      `INSERT INTO users (full_name, email, currency_code, email_verified_at)
       VALUES (?, ?, ?, NOW())`,
      [fullName || "Google User", email, "PKR"]
    );
    const [newUserRows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId
    ]);
    user = newUserRows[0];
  }

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
}

module.exports = {
  requestOtp,
  verifyOtp,
  requestEmailOtp,
  verifyEmailOtp,
  login,
  getUserProfile,
  loginWithGoogle
};
