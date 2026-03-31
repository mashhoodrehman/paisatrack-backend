const pool = require("../db/pool");
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
      await connection.query(
        `INSERT INTO committee_members (committee_id, member_name, member_phone, user_id, is_guest, is_registered)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          member.name,
          member.phone || null,
          member.userId || null,
          member.isGuest ? 1 : 0,
          member.isRegistered ? 1 : 0,
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
  const [result] = await pool.query(
    `INSERT INTO committee_installments
     (committee_id, paid_by_member, amount, installment_date, month_label, payment_method_id, payment_account, credit_card_id, reflect_in_net, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      committeeId,
      payload.paidByMember,
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

  await createTimelineEvent(null, {
    userId,
    eventType: TIMELINE_TYPES.COMMITTEE_INSTALLMENT,
    title: "Committee installment paid",
    subtitle: payload.paidByMember,
    amount: payload.amount,
    eventDate: payload.date,
    referenceTable: "committee_installments",
    referenceId: result.insertId,
    metadata: payload,
  });

  return { id: result.insertId, message: "Committee installment added successfully" };
}

async function getCommittees(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM committees WHERE user_id = ? ORDER BY id DESC",
    [userId]
  );

  const result = [];
  for (const committee of rows) {
    const [members] = await pool.query(
      "SELECT * FROM committee_members WHERE committee_id = ? ORDER BY id ASC",
      [committee.id]
    );
    const [installments] = await pool.query(
      `SELECT ci.*, pm.name AS payment_method_name
       FROM committee_installments ci
       LEFT JOIN payment_methods pm ON pm.id = ci.payment_method_id
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
