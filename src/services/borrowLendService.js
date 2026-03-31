const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createRecord(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO borrow_lend_records
       (user_id, person_name, record_type, amount, record_date, return_date, status, person_user_id, payment_method_id, payment_account, credit_card_id, reflect_in_net, due_alert_enabled, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.personName,
        payload.type,
        payload.amount,
        payload.date,
        payload.returnDate || null,
        payload.status || "pending",
        payload.personUserId || null,
        payload.paymentMethodId || null,
        payload.paymentAccount || null,
        payload.creditCardId || null,
        payload.reflectInNet === false ? 0 : 1,
        payload.dueAlertEnabled === false ? 0 : 1,
        payload.notes || null,
      ]
    );

    let mirrorRecordId = null;

    if (payload.personUserId) {
      const mirrorType = payload.type === "borrow" ? "lend" : "borrow";
      const [mirrorResult] = await connection.query(
        `INSERT INTO borrow_lend_records
         (user_id, person_name, record_type, amount, record_date, return_date, status, person_user_id, payment_method_id, payment_account, credit_card_id, reflect_in_net, due_alert_enabled, mirror_record_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.personUserId,
          payload.ownerName || "Friend",
          mirrorType,
          payload.amount,
          payload.date,
          payload.returnDate || null,
          payload.status || "pending",
          userId,
          payload.paymentMethodId || null,
          payload.paymentAccount || null,
          null,
          payload.reflectInNet === false ? 0 : 1,
          payload.dueAlertEnabled === false ? 0 : 1,
          result.insertId,
          payload.notes || null,
        ]
      );

      mirrorRecordId = mirrorResult.insertId;
      await connection.query(
        "UPDATE borrow_lend_records SET mirror_record_id = ? WHERE id = ?",
        [mirrorRecordId, result.insertId]
      );
    }

    await createTimelineEvent(connection, {
      userId,
      eventType: TIMELINE_TYPES.BORROW_LEND,
      title: payload.type === "borrow" ? "Money borrowed" : "Money lent",
      subtitle: payload.personName,
      amount: payload.amount,
      eventDate: payload.date,
      referenceTable: "borrow_lend_records",
      referenceId: result.insertId,
      metadata: payload,
    });

    if (payload.personUserId) {
      await createTimelineEvent(connection, {
        userId: payload.personUserId,
        eventType: TIMELINE_TYPES.BORROW_LEND,
        title: payload.type === "borrow" ? "Friend borrowed from you" : "Friend lent you money",
        subtitle: payload.ownerName || "Friend",
        amount: payload.amount,
        eventDate: payload.date,
        referenceTable: "borrow_lend_records",
        referenceId: mirrorRecordId,
        metadata: payload,
      });
    }

    await connection.commit();

    return { id: result.insertId, mirrorRecordId, message: "Borrow/lend record created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRecords(userId) {
  const [rows] = await pool.query(
    `SELECT blr.*, pm.name AS payment_method_name
     FROM borrow_lend_records blr
     LEFT JOIN payment_methods pm ON pm.id = blr.payment_method_id
     WHERE blr.user_id = ?
     ORDER BY blr.record_date DESC, blr.id DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  createRecord,
  getRecords,
};
