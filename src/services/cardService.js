const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createCard(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO credit_cards
     (user_id, card_name, bank_name, last_four_digits, credit_limit, billing_cycle_day, due_day, outstanding_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.cardName,
      payload.bankName,
      payload.lastFourDigits,
      payload.creditLimit,
      payload.billingCycleDay,
      payload.dueDay,
      0
    ]
  );

  return { id: result.insertId, message: "Credit card added successfully" };
}

async function getCards(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM credit_cards WHERE user_id = ? ORDER BY id DESC",
    [userId]
  );
  return rows;
}

async function getCardDetail(userId, cardId) {
  const [[card]] = await pool.query(
    "SELECT * FROM credit_cards WHERE id = ? AND user_id = ?",
    [cardId, userId]
  );

  const [transactions] = await pool.query(
    `SELECT * FROM credit_card_transactions
     WHERE credit_card_id = ?
     ORDER BY transaction_date DESC, id DESC`,
    [cardId]
  );

  const [[payments]] = await pool.query(
    `SELECT COALESCE(SUM(amount_paid), 0) AS paid_amount
     FROM credit_card_payments
     WHERE credit_card_id = ?`,
    [cardId]
  );

  return {
    card,
    transactions,
    statementTotal: Number(card.outstanding_balance || 0) + Number(payments.paid_amount || 0),
    outstandingBalance: Number(card.outstanding_balance || 0),
    paidAmount: Number(payments.paid_amount || 0),
    remainingAmount: Number(card.outstanding_balance || 0)
  };
}

async function payBill(userId, cardId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO credit_card_payments
       (credit_card_id, amount_paid, payment_date, payment_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [cardId, payload.amountPaid, payload.paymentDate, payload.paymentType, payload.notes || null]
    );

    await connection.query(
      `UPDATE credit_cards
       SET outstanding_balance = GREATEST(outstanding_balance - ?, 0)
       WHERE id = ? AND user_id = ?`,
      [payload.amountPaid, cardId, userId]
    );

    await createTimelineEvent(connection, {
      userId,
      eventType: TIMELINE_TYPES.CREDIT_CARD_PAYMENT,
      title: "Credit card bill paid",
      subtitle: payload.paymentType,
      amount: payload.amountPaid,
      eventDate: payload.paymentDate,
      referenceTable: "credit_card_payments",
      referenceId: cardId,
      metadata: payload
    });

    await connection.commit();
    return { message: "Credit card payment recorded successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createCard,
  getCards,
  getCardDetail,
  payBill
};
