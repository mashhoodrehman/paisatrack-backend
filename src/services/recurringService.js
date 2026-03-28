const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createRecurringPayment(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO recurring_payments
     (user_id, title, amount, frequency, next_due_date, reminder_days_before, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.title,
      payload.amount,
      payload.frequency,
      payload.nextDueDate,
      payload.reminderDaysBefore || 3,
      payload.notes || null
    ]
  );

  await createTimelineEvent(null, {
    userId,
    eventType: TIMELINE_TYPES.RECURRING_PAYMENT,
    title: "Recurring payment added",
    subtitle: payload.title,
    amount: payload.amount,
    eventDate: payload.nextDueDate,
    referenceTable: "recurring_payments",
    referenceId: result.insertId,
    metadata: payload
  });

  return { id: result.insertId, message: "Recurring payment created successfully" };
}

async function getRecurringPayments(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM recurring_payments WHERE user_id = ? ORDER BY next_due_date ASC",
    [userId]
  );
  return rows;
}

module.exports = {
  createRecurringPayment,
  getRecurringPayments
};
