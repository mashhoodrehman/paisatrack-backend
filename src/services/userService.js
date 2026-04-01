const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");

async function updateSetup(userId, payload) {
  await pool.query(
    `UPDATE users
     SET full_name = COALESCE(?, full_name),
         username = COALESCE(?, username),
         monthly_income = COALESCE(?, monthly_income),
         income_source = COALESCE(?, income_source),
         income_profile_type = COALESCE(?, income_profile_type),
         income_frequency = COALESCE(?, income_frequency),
         currency_code = COALESCE(?, currency_code)
     WHERE id = ?`,
    [
      payload.fullName || null,
      payload.username || null,
      payload.monthlyIncome || null,
      payload.incomeSource || null,
      payload.incomeType || null,
      payload.incomeCadence || null,
      payload.currencyCode || null,
      userId,
    ]
  );

  const [rows] = await pool.query(
    "SELECT id, full_name, username, phone_number, email, email_verified_at, monthly_income, income_source, income_profile_type, income_frequency, currency_code FROM users WHERE id = ?",
    [userId]
  );

  return rows[0];
}

async function getSettings(userId) {
  const [userRows] = await pool.query(
    `SELECT id, full_name, username, phone_number, email, email_verified_at, monthly_income, income_source, income_profile_type, income_frequency, currency_code, language_code,
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
         is_premium = COALESCE(?, is_premium),
         income_source = COALESCE(?, income_source),
         income_profile_type = COALESCE(?, income_profile_type),
         income_frequency = COALESCE(?, income_frequency)
     WHERE id = ?`,
    [
      payload.currencyCode,
      payload.languageCode,
      payload.notificationsEnabled,
      payload.whatsappSharingEnabled,
      payload.isPremium,
      payload.incomeSource,
      payload.incomeType,
      payload.incomeCadence,
      userId,
    ]
  );

  return getSettings(userId);
}

async function searchUsers(userId, query) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return [];

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.phone_number,
            CASE
              WHEN uf.status = 'accepted' THEN 'friend'
              WHEN uf.status = 'pending' THEN 'pending'
              ELSE 'none'
            END AS relationship_status
     FROM users u
     LEFT JOIN user_friends uf
       ON ((uf.user_id = ? AND uf.friend_user_id = u.id) OR (uf.friend_user_id = ? AND uf.user_id = u.id))
     WHERE u.id != ?
       AND (
         u.username LIKE ?
         OR u.email LIKE ?
         OR u.full_name LIKE ?
         OR u.phone_number LIKE ?
       )
     ORDER BY u.full_name ASC
     LIMIT 10`,
    [userId, userId, userId, `%${safeQuery}%`, `%${safeQuery}%`, `%${safeQuery}%`, `%${safeQuery}%`]
  );

  return rows;
}

async function sendFriendRequest(userId, friendUserId) {
  if (Number(userId) === Number(friendUserId)) {
    throw new ApiError(400, "You cannot add yourself as a friend");
  }

  const [[target]] = await pool.query(
    "SELECT id, full_name, username FROM users WHERE id = ?",
    [friendUserId]
  );

  if (!target) {
    throw new ApiError(404, "Target user not found");
  }

  const [existing] = await pool.query(
    `SELECT * FROM user_friends
     WHERE (user_id = ? AND friend_user_id = ?)
        OR (user_id = ? AND friend_user_id = ?)`,
    [userId, friendUserId, friendUserId, userId]
  );

  if (existing.length) {
    return { message: "Friend relationship already exists", friend: target, relationship: existing[0] };
  }

  const [result] = await pool.query(
    `INSERT INTO user_friends (user_id, friend_user_id, requested_by_user_id, status)
     VALUES (?, ?, ?, 'pending')`,
    [userId, friendUserId, userId]
  );

  await pool.query(
    `INSERT INTO reminders
     (user_id, reminder_type, title, message, due_date, reference_table, reference_id)
     VALUES (?, 'friend_request', ?, ?, CURDATE(), 'user_friends', ?)`,
    [
      friendUserId,
      "New friend request",
      "Someone sent you a friend request in PaisaTrack PK",
      result.insertId,
    ]
  );

  return { id: result.insertId, message: "Friend request sent successfully", friend: target };
}

async function acceptFriendRequest(userId, requestId) {
  const [[request]] = await pool.query(
    "SELECT * FROM user_friends WHERE id = ?",
    [requestId]
  );

  if (!request) throw new ApiError(404, "Friend request not found");
  if (Number(request.friend_user_id) !== Number(userId)) {
    throw new ApiError(403, "You can only accept requests sent to you");
  }

  await pool.query(
    "UPDATE user_friends SET status = 'accepted' WHERE id = ?",
    [requestId]
  );

  return { message: "Friend request accepted" };
}

async function getFriends(userId) {
  const [rows] = await pool.query(
    `SELECT uf.id, uf.status, uf.created_at,
            CASE WHEN uf.user_id = ? THEN friend.id ELSE owner.id END AS friend_id,
            CASE WHEN uf.user_id = ? THEN friend.full_name ELSE owner.full_name END AS full_name,
            CASE WHEN uf.user_id = ? THEN friend.username ELSE owner.username END AS username,
            CASE WHEN uf.user_id = ? THEN friend.email ELSE owner.email END AS email,
            CASE WHEN uf.user_id = ? THEN friend.phone_number ELSE owner.phone_number END AS phone_number
     FROM user_friends uf
     INNER JOIN users owner ON owner.id = uf.user_id
     INNER JOIN users friend ON friend.id = uf.friend_user_id
     WHERE (uf.user_id = ? OR uf.friend_user_id = ?)
     ORDER BY uf.updated_at DESC, uf.id DESC`,
    [userId, userId, userId, userId, userId, userId, userId]
  );

  return rows;
}

async function addIncomeEntry(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO income_entries (user_id, source, amount, income_date, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, payload.source, payload.amount, payload.date, payload.notes || null]
  );

  return { id: result.insertId, message: "Income entry created successfully" };
}

async function getIncomeEntries(userId) {
  const [rows] = await pool.query(
    `SELECT id, source, amount, income_date, notes, created_at
     FROM income_entries
     WHERE user_id = ?
     ORDER BY income_date DESC, id DESC`,
    [userId]
  );
  return rows;
}

async function getReminders(userId) {
  const [storedReminders] = await pool.query(
    `SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date DESC, id DESC LIMIT 50`,
    [userId]
  );

  const [borrowAlerts] = await pool.query(
    `SELECT id, person_name, amount, return_date
     FROM borrow_lend_records
     WHERE user_id = ? AND due_alert_enabled = 1 AND status != 'paid' AND return_date IS NOT NULL AND return_date <= CURDATE()
     ORDER BY return_date ASC`,
    [userId]
  );

  const [recurringAlerts] = await pool.query(
    `SELECT id, title, amount, next_due_date, category_name, payment_account
     FROM recurring_payments
     WHERE user_id = ?
       AND reminder_days_before >= 0
       AND next_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL GREATEST(reminder_days_before, 0) DAY)
     ORDER BY next_due_date ASC`,
    [userId]
  );

  return {
    stored: storedReminders,
    dueBorrowReturns: borrowAlerts.map((item) => ({
      id: item.id,
      reminderType: "borrow_return",
      title: "Return amount due",
      message: `You have to settle ${item.person_name} by ${item.return_date}`,
      amount: Number(item.amount || 0),
      dueDate: item.return_date,
    })),
    recurringPayments: recurringAlerts.map((item) => ({
      id: item.id,
      reminderType: "recurring_payment",
      title: `${item.title} payment due`,
      message: `It's time to pay ${item.title}${item.category_name ? ` for ${item.category_name}` : ""} by ${item.next_due_date} using ${item.payment_account || "your selected method"}.`,
      amount: Number(item.amount || 0),
      dueDate: item.next_due_date,
      category: item.category_name || "Other",
    })),
  };
}

module.exports = {
  updateSetup,
  getSettings,
  updateSettings,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  getFriends,
  addIncomeEntry,
  getIncomeEntries,
  getReminders,
};
