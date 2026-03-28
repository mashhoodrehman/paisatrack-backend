const pool = require("../db/pool");

async function updateSetup(userId, payload) {
  await pool.query(
    `UPDATE users
     SET full_name = COALESCE(?, full_name),
         monthly_income = COALESCE(?, monthly_income),
         currency_code = COALESCE(?, currency_code)
     WHERE id = ?`,
    [payload.fullName || null, payload.monthlyIncome || null, payload.currencyCode || null, userId]
  );

  const [rows] = await pool.query(
    "SELECT id, full_name, phone_number, email, monthly_income, currency_code FROM users WHERE id = ?",
    [userId]
  );

  return rows[0];
}

async function getSettings(userId) {
  const [userRows] = await pool.query(
    `SELECT id, full_name, phone_number, email, monthly_income, currency_code, language_code,
            notifications_enabled, whatsapp_sharing_enabled, is_premium
     FROM users WHERE id = ?`,
    [userId]
  );
  return userRows[0];
}

async function updateSettings(userId, payload) {
  await pool.query(
    `UPDATE users
     SET currency_code = COALESCE(?, currency_code),
         language_code = COALESCE(?, language_code),
         notifications_enabled = COALESCE(?, notifications_enabled),
         whatsapp_sharing_enabled = COALESCE(?, whatsapp_sharing_enabled),
         is_premium = COALESCE(?, is_premium)
     WHERE id = ?`,
    [
      payload.currencyCode,
      payload.languageCode,
      payload.notificationsEnabled,
      payload.whatsappSharingEnabled,
      payload.isPremium,
      userId
    ]
  );

  return getSettings(userId);
}

module.exports = {
  updateSetup,
  getSettings,
  updateSettings
};
