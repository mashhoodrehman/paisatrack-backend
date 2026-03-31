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
      (user_id, group_id, amount, category_id, payment_method_id, payment_account, expense_date, notes, receipt_url, is_credit_card, credit_card_id, reflect_in_net, created_via)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        payload.reflectInNet === false ? 0 : 1,
        payload.createdVia || "manual",
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
        createdVia: payload.createdVia || "manual",
        reflectInNet: payload.reflectInNet !== false,
      },
    });

    if (payload.splitParticipants?.length) {
      for (const participant of payload.splitParticipants) {
        let participantUserId = participant.userId || null;
        let isRegistered = 0;
        let inviteStatus = participant.inviteStatus || "none";

        if (!participantUserId && (participant.username || participant.email || participant.phone)) {
          const [matches] = await connection.query(
            `SELECT id FROM users
             WHERE username = COALESCE(?, username)
                OR email = COALESCE(?, email)
                OR phone_number = COALESCE(?, phone_number)
             LIMIT 1`,
            [participant.username || null, participant.email || null, participant.phone || null]
          );
          participantUserId = matches[0]?.id || null;
        }

        if (participantUserId) {
          isRegistered = 1;
          inviteStatus = participantUserId === userId ? "accepted" : inviteStatus || "accepted";
        }

        await connection.query(
          `INSERT INTO expense_shares
          (expense_id, participant_name, participant_user_id, participant_phone, participant_email, share_type, share_amount, percentage_share, paid_amount, is_registered, invite_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            participant.name,
            participantUserId,
            participant.phone || null,
            participant.email || null,
            participant.shareType || "equal",
            participant.shareAmount || 0,
            participant.percentageShare || null,
            participant.paidAmount || 0,
            isRegistered,
            inviteStatus,
          ]
        );

        if (participantUserId && Number(participantUserId) !== Number(userId)) {
          await createTimelineEvent(connection, {
            userId: participantUserId,
            eventType: TIMELINE_TYPES.SPLIT_EXPENSE,
            title: "You were added to a split",
            subtitle: payload.notes || participant.name,
            amount: participant.shareAmount || 0,
            eventDate: payload.date,
            referenceTable: "expenses",
            referenceId: result.insertId,
            metadata: {
              ownerUserId: userId,
              splitShare: participant.shareAmount || 0,
              paidAmount: participant.paidAmount || 0,
            },
          });
        }
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
  const params = [];
  const joinShared = filters.type === "split";
  const userCondition = joinShared
    ? `(e.user_id = ? OR EXISTS (SELECT 1 FROM expense_shares shared_es WHERE shared_es.expense_id = e.id AND shared_es.participant_user_id = ?))`
    : `e.user_id = ?`;

  params.push(userId);
  if (joinShared) params.push(userId);

  const conditions = [userCondition];

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
    `SELECT participant_name, participant_user_id, participant_phone, participant_email, share_amount, paid_amount, is_registered, invite_status
     FROM expense_shares
     WHERE expense_id = ?`,
    [expenseId]
  );

  if (!shares.length) {
    throw new ApiError(404, "Split expense not found");
  }

  return shares.map((share) => ({
    participantName: share.participant_name,
    participantUserId: share.participant_user_id,
    participantPhone: share.participant_phone,
    participantEmail: share.participant_email,
    shareAmount: Number(share.share_amount),
    paidAmount: Number(share.paid_amount),
    isRegistered: Boolean(share.is_registered),
    inviteStatus: share.invite_status,
    netSettlement: Number(share.paid_amount) - Number(share.share_amount),
  }));
}

async function settleSplitExpense(userId, expenseId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[expense]] = await connection.query(
      `SELECT id, user_id, notes, expense_date
       FROM expenses
       WHERE id = ?`,
      [expenseId]
    );

    if (!expense) {
      throw new ApiError(404, "Split expense not found");
    }

    const [shares] = await connection.query(
      `SELECT id, participant_name, participant_user_id, share_amount, paid_amount
       FROM expense_shares
       WHERE expense_id = ?`,
      [expenseId]
    );

    if (!shares.length) {
      throw new ApiError(404, "Split participants not found");
    }

    const targetShare = shares.find((share) => {
      if (payload.participantUserId) {
        return Number(share.participant_user_id) === Number(payload.participantUserId);
      }
      return (
        String(share.participant_name).trim().toLowerCase() ===
        String(payload.participantName || "").trim().toLowerCase()
      );
    });

    if (!targetShare) {
      throw new ApiError(404, "Participant not found in this split");
    }

    const amount = Number(payload.amount || 0);
    if (!amount || amount <= 0) {
      throw new ApiError(400, "Settlement amount is required");
    }

    const nextPaidAmount = Math.min(
      Number(targetShare.share_amount || 0),
      Number(targetShare.paid_amount || 0) + amount
    );

    await connection.query(
      `UPDATE expense_shares
       SET paid_amount = ?
       WHERE id = ?`,
      [nextPaidAmount, targetShare.id]
    );

    if (expense.user_id && Number(expense.user_id) !== Number(userId)) {
      await createTimelineEvent(connection, {
        userId: expense.user_id,
        eventType: TIMELINE_TYPES.SPLIT_EXPENSE,
        title: "Split settlement received",
        subtitle: targetShare.participant_name,
        amount,
        eventDate: payload.paymentDate || expense.expense_date,
        referenceTable: "expenses",
        referenceId: expenseId,
        metadata: {
          settlement: true,
          participantUserId: targetShare.participant_user_id,
          participantName: targetShare.participant_name,
          paidAmount: nextPaidAmount,
          shareAmount: Number(targetShare.share_amount || 0),
        },
      });
    }

    if (targetShare.participant_user_id && Number(targetShare.participant_user_id) !== Number(userId)) {
      await createTimelineEvent(connection, {
        userId: targetShare.participant_user_id,
        eventType: TIMELINE_TYPES.SPLIT_EXPENSE,
        title: "Split settled",
        subtitle: expense.notes || targetShare.participant_name,
        amount,
        eventDate: payload.paymentDate || expense.expense_date,
        referenceTable: "expenses",
        referenceId: expenseId,
        metadata: {
          settlement: true,
          paidAmount: nextPaidAmount,
          shareAmount: Number(targetShare.share_amount || 0),
        },
      });
    }

    await connection.commit();

    return {
      participantName: targetShare.participant_name,
      paidAmount: nextPaidAmount,
      shareAmount: Number(targetShare.share_amount || 0),
      message: "Split settled successfully",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createExpense,
  getExpenses,
  getSplitSettlements,
  settleSplitExpense,
};
