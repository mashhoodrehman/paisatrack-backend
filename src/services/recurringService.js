const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

function addCycle(dateValue, frequency) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (frequency === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().slice(0, 10);
}

async function createRecurringPayment(userId, payload) {
  const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
  const nextDueDate = payload.nextDueDate || addCycle(startDate, payload.frequency) || startDate;

  const [result] = await pool.query(
    `INSERT INTO recurring_payments
     (user_id, title, amount, frequency, start_date, next_due_date, category_name, payment_account, reminder_days_before, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.title,
      payload.amount,
      payload.frequency,
      startDate,
      nextDueDate,
      payload.categoryName || "Other",
      payload.paymentAccount || "Cash",
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
    eventDate: nextDueDate,
    referenceTable: "recurring_payments",
    referenceId: result.insertId,
    metadata: {
      ...payload,
      startDate,
      nextDueDate,
    }
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
