const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createCommittee(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO committees
       (user_id, name, contribution_amount, payout_order_index, next_payout_member)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        payload.name,
        payload.contributionAmount,
        payload.payoutOrderIndex || 1,
        payload.nextPayoutMember || null
      ]
    );

    for (const member of payload.members || []) {
      await connection.query(
        `INSERT INTO committee_members (committee_id, member_name, member_phone)
         VALUES (?, ?, ?)`,
        [result.insertId, member.name, member.phone || null]
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
     (committee_id, paid_by_member, amount, installment_date, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [committeeId, payload.paidByMember, payload.amount, payload.date, payload.notes || null]
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
    metadata: payload
  });

  return { id: result.insertId, message: "Committee installment added successfully" };
}

async function getCommittees(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM committees WHERE user_id = ? ORDER BY id DESC",
    [userId]
  );
  return rows;
}

module.exports = {
  createCommittee,
  createInstallment,
  getCommittees
};
