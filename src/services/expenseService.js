const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createExpense(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO expenses
      (user_id, group_id, amount, category_id, payment_method_id, payment_account, expense_date, notes, receipt_url, is_credit_card, credit_card_id, created_via)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.groupId || null,
        payload.amount,
        payload.categoryId,
        payload.paymentMethodId,
        payload.paymentAccount || null,
        payload.date,
        payload.notes || null,
        payload.receiptUrl || null,
        payload.isCreditCard ? 1 : 0,
        payload.creditCardId || null,
        payload.createdVia || "manual"
      ]
    );

    if (payload.isCreditCard && payload.creditCardId) {
      await connection.query(
        `INSERT INTO credit_card_transactions
        (credit_card_id, expense_id, amount, transaction_date, notes)
        VALUES (?, ?, ?, ?, ?)`,
        [payload.creditCardId, result.insertId, payload.amount, payload.date, payload.notes || null]
      );

      await connection.query(
        `UPDATE credit_cards
         SET outstanding_balance = outstanding_balance + ?
         WHERE id = ? AND user_id = ?`,
        [payload.amount, payload.creditCardId, userId]
      );
    }

    await createTimelineEvent(connection, {
      userId,
      eventType: payload.splitParticipants?.length ? TIMELINE_TYPES.SPLIT_EXPENSE : TIMELINE_TYPES.EXPENSE,
      title: payload.splitParticipants?.length ? "Split expense added" : "Expense recorded",
      subtitle: payload.notes || payload.displayLabel || "Financial record created",
      amount: payload.amount,
      eventDate: payload.date,
      referenceTable: "expenses",
      referenceId: result.insertId,
      metadata: {
        categoryId: payload.categoryId,
        groupId: payload.groupId || null,
        createdVia: payload.createdVia || "manual"
      }
    });

    if (payload.splitParticipants?.length) {
      for (const participant of payload.splitParticipants) {
        await connection.query(
          `INSERT INTO expense_shares
          (expense_id, participant_name, participant_phone, share_type, share_amount, percentage_share, paid_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            participant.name,
            participant.phone || null,
            participant.shareType || "equal",
            participant.shareAmount || 0,
            participant.percentageShare || null,
            participant.paidAmount || 0
          ]
        );
      }
    }

    await connection.commit();

    return { id: result.insertId, message: "Expense created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getExpenses(userId, filters) {
  const conditions = ["e.user_id = ?"];
  const params = [userId];

  if (filters.categoryId) {
    conditions.push("e.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.paymentMethodId) {
    conditions.push("e.payment_method_id = ?");
    params.push(filters.paymentMethodId);
  }
  if (filters.type === "split") {
    conditions.push("EXISTS (SELECT 1 FROM expense_shares es WHERE es.expense_id = e.id)");
  }
  if (filters.search) {
    conditions.push("(e.notes LIKE ? OR c.name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const [rows] = await pool.query(
    `SELECT e.*, c.name AS category_name, pm.name AS payment_method_name
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.expense_date DESC, e.id DESC`,
    params
  );

  return rows;
}

async function getSplitSettlements(expenseId) {
  const [shares] = await pool.query(
    `SELECT participant_name, share_amount, paid_amount
     FROM expense_shares
     WHERE expense_id = ?`,
    [expenseId]
  );

  if (!shares.length) {
    throw new ApiError(404, "Split expense not found");
  }

  return shares.map((share) => ({
    participantName: share.participant_name,
    shareAmount: Number(share.share_amount),
    paidAmount: Number(share.paid_amount),
    netSettlement: Number(share.paid_amount) - Number(share.share_amount)
  }));
}

module.exports = {
  createExpense,
  getExpenses,
  getSplitSettlements
};
