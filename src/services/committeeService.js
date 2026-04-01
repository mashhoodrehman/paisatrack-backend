const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createCommittee(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const totalMembers = payload.totalMembers || (payload.members || []).length;
    const totalMonths = payload.totalMonths || totalMembers;
    const totalAmount = payload.totalAmount || Number(payload.contributionAmount || 0) * Number(totalMonths || 0);

    const [result] = await connection.query(
      `INSERT INTO committees
       (user_id, name, contribution_amount, total_amount, total_members, total_months, payout_order_index, next_payout_member, reflect_in_net_by_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.name,
        payload.contributionAmount,
        totalAmount,
        totalMembers,
        totalMonths,
        payload.payoutOrderIndex || 1,
        payload.nextPayoutMember || null,
        payload.reflectInNetByDefault === false ? 0 : 1,
      ]
    );

    for (const member of payload.members || []) {
      let memberUserId = member.userId || null;

      if (!memberUserId && (member.email || member.phone)) {
        const [matches] = await connection.query(
          `SELECT id, full_name, phone_number, email
           FROM users
           WHERE (? IS NOT NULL AND email = ?)
              OR (? IS NOT NULL AND phone_number = ?)
           LIMIT 1`,
          [member.email || null, member.email || null, member.phone || null, member.phone || null]
        );

        if (matches[0]) {
          memberUserId = matches[0].id;
          member.name = matches[0].full_name || member.name;
          member.phone = matches[0].phone_number || member.phone;
          member.email = matches[0].email || member.email;
        }
      }

      await connection.query(
        `INSERT INTO committee_members (committee_id, member_name, member_phone, member_email, user_id, is_guest, is_registered)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          member.name,
          member.phone || null,
          member.email || null,
          memberUserId,
          member.isGuest && !memberUserId ? 1 : 0,
          memberUserId || member.isRegistered ? 1 : 0,
        ]
      );
    }

    await connection.commit();
    return { id: result.insertId, message: "Committee created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createInstallment(userId, committeeId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[committee]] = await connection.query(
      `SELECT c.*
       FROM committees c
       LEFT JOIN committee_members cm ON cm.committee_id = c.id
       WHERE c.id = ? AND (c.user_id = ? OR cm.user_id = ?)
       LIMIT 1`,
      [committeeId, userId, userId]
    );

    if (!committee) {
      throw new ApiError(404, "Committee not found");
    }

    let paidByMemberId = payload.paidByMemberId || null;
    let paidByMember = payload.paidByMember || null;

    if (paidByMemberId) {
      const [[member]] = await connection.query(
        "SELECT id, member_name, user_id FROM committee_members WHERE committee_id = ? AND user_id = ? LIMIT 1",
        [committeeId, paidByMemberId]
      );
      if (!member) {
        throw new ApiError(404, "Selected committee member was not found");
      }
      paidByMember = member.member_name;
      paidByMemberId = member.user_id || paidByMemberId;
    } else if (paidByMember) {
      const [[member]] = await connection.query(
        "SELECT id, member_name, user_id FROM committee_members WHERE committee_id = ? AND member_name = ? LIMIT 1",
        [committeeId, paidByMember]
      );
      if (member) {
        paidByMember = member.member_name;
        paidByMemberId = member.user_id || null;
      }
    }

    if (!paidByMember) {
      throw new ApiError(400, "Paid by member is required");
    }

    const [result] = await connection.query(
      `INSERT INTO committee_installments
       (committee_id, paid_by_member, paid_by_member_id, recorded_by_user_id, amount, installment_date, month_label, payment_method_id, payment_account, credit_card_id, reflect_in_net, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        committeeId,
        paidByMember,
        paidByMemberId,
        userId,
        payload.amount,
        payload.date,
        payload.monthLabel || null,
        payload.paymentMethodId || null,
        payload.paymentAccount || null,
        payload.creditCardId || null,
        payload.reflectInNet === false ? 0 : 1,
        payload.notes || null,
      ]
    );

    const [audience] = await connection.query(
      `SELECT DISTINCT target_user_id
       FROM (
         SELECT c.user_id AS target_user_id FROM committees c WHERE c.id = ?
         UNION
         SELECT cm.user_id AS target_user_id FROM committee_members cm WHERE cm.committee_id = ? AND cm.user_id IS NOT NULL
       ) members`,
      [committeeId, committeeId]
    );

    for (const target of audience) {
      await createTimelineEvent(connection, {
        userId: target.target_user_id,
        eventType: TIMELINE_TYPES.COMMITTEE_INSTALLMENT,
        title: "Committee installment paid",
        subtitle: paidByMember,
        amount: payload.amount,
        eventDate: payload.date,
        referenceTable: "committee_installments",
        referenceId: result.insertId,
        metadata: {
          ...payload,
          committeeId,
          paidByMember,
          paidByMemberId,
          recordedByUserId: userId,
        },
      });
    }

    await connection.commit();
    return { id: result.insertId, message: "Committee installment added successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getCommittees(userId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT c.*
     FROM committees c
     LEFT JOIN committee_members cm ON cm.committee_id = c.id
     WHERE c.user_id = ? OR cm.user_id = ?
     ORDER BY c.id DESC`,
    [userId]
  );

  const result = [];
  for (const committee of rows) {
    const [members] = await pool.query(
      "SELECT * FROM committee_members WHERE committee_id = ? ORDER BY id ASC",
      [committee.id]
    );
    const [installments] = await pool.query(
      `SELECT ci.*, pm.name AS payment_method_name, recorder.full_name AS recorded_by_name
       FROM committee_installments ci
       LEFT JOIN payment_methods pm ON pm.id = ci.payment_method_id
       LEFT JOIN users recorder ON recorder.id = ci.recorded_by_user_id
       WHERE ci.committee_id = ?
       ORDER BY ci.installment_date DESC, ci.id DESC`,
      [committee.id]
    );

    result.push({
      ...committee,
      members,
      installments,
    });
  }

  return result;
}

module.exports = {
  createCommittee,
  createInstallment,
  getCommittees,
};
