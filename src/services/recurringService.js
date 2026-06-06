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

async function resolveCategoryId(name) {
  const [rows] = await pool.query(
    "SELECT id FROM categories WHERE name = ? ORDER BY id LIMIT 1",
    [name || "Other"]
  );
  if (rows.length) return rows[0].id;
  const [fallback] = await pool.query("SELECT id FROM categories ORDER BY id LIMIT 1");
  return fallback.length ? fallback[0].id : null;
}

async function resolvePaymentMethodId(name) {
  const [rows] = await pool.query(
    "SELECT id FROM payment_methods WHERE name = ? ORDER BY id LIMIT 1",
    [name || "Cash"]
  );
  if (rows.length) return rows[0].id;
  const [fallback] = await pool.query("SELECT id FROM payment_methods ORDER BY id LIMIT 1");
  return fallback.length ? fallback[0].id : null;
}

/**
 * Auto-processes recurring payments that are due (next_due_date <= today):
 * records an expense for each due cycle, raises a reminder, and advances the
 * next due date. Runs lazily whenever recurring payments are fetched so the
 * deduction "appears automatically" once the date arrives. Catches up to 24
 * missed cycles to avoid runaway loops.
 */
async function processDueRecurringPayments(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const [due] = await pool.query(
    "SELECT * FROM recurring_payments WHERE user_id = ? AND next_due_date <= ?",
    [userId, today]
  );

  for (const payment of due) {
    const categoryId = await resolveCategoryId(payment.category_name);
    const paymentMethodId = await resolvePaymentMethodId(payment.payment_account);
    if (!categoryId || !paymentMethodId) continue;

    let dueDate = payment.next_due_date instanceof Date
      ? payment.next_due_date.toISOString().slice(0, 10)
      : String(payment.next_due_date).slice(0, 10);
    let guard = 0;

    while (dueDate <= today && guard < 24) {
      guard += 1;

      const [inserted] = await pool.query(
        `INSERT INTO expenses
         (user_id, amount, category_id, payment_method_id, payment_account, expense_date, notes, reflect_in_net, created_via)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'manual')`,
        [
          userId,
          payment.amount,
          categoryId,
          paymentMethodId,
          payment.payment_account || "Cash",
          `${dueDate} 00:00:00`,
          `${payment.title} (recurring)`,
        ]
      );

      await pool.query(
        `INSERT INTO reminders
         (user_id, reminder_type, title, message, due_date, reference_table, reference_id)
         VALUES (?, 'recurring_payment', ?, ?, ?, 'recurring_payments', ?)`,
        [
          userId,
          `${payment.title} auto-paid`,
          `PKR ${Number(payment.amount).toLocaleString()} for ${payment.title} was deducted on ${dueDate}.`,
          dueDate,
          payment.id,
        ]
      );

      try {
        await createTimelineEvent(null, {
          userId,
          eventType: TIMELINE_TYPES.RECURRING_PAYMENT,
          title: `${payment.title} auto-paid`,
          subtitle: payment.category_name || "Recurring",
          amount: payment.amount,
          eventDate: dueDate,
          referenceTable: "expenses",
          referenceId: inserted.insertId,
          metadata: { recurringId: payment.id, frequency: payment.frequency },
        });
      } catch {
        // timeline is best-effort
      }

      dueDate = addCycle(dueDate, payment.frequency) || today;
    }

    await pool.query(
      "UPDATE recurring_payments SET next_due_date = ? WHERE id = ? AND user_id = ?",
      [dueDate, payment.id, userId]
    );
  }
}

async function getRecurringPayments(userId) {
  await processDueRecurringPayments(userId);
  const [rows] = await pool.query(
    "SELECT * FROM recurring_payments WHERE user_id = ? ORDER BY next_due_date ASC",
    [userId]
  );
  return rows;
}

async function deleteRecurringPayment(userId, recurringId) {
  const [result] = await pool.query(
    "DELETE FROM recurring_payments WHERE id = ? AND user_id = ?",
    [recurringId, userId]
  );

  if (!result.affectedRows) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(404, "Recurring payment not found");
  }

  // Remove its timeline log too so deleted recurring payments don't linger.
  await pool.query(
    "DELETE FROM financial_timeline WHERE user_id = ? AND reference_table = 'recurring_payments' AND reference_id = ?",
    [userId, recurringId]
  );

  return { id: Number(recurringId), message: "Recurring payment deleted successfully" };
}

module.exports = {
  createRecurringPayment,
  getRecurringPayments,
  deleteRecurringPayment,
  processDueRecurringPayments
};
