const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createMirrorRecord(connection, sourceRecordId, ownerUserId, mirrorUserId, payload) {
  const mirrorType = payload.type === "borrow" ? "lend" : "borrow";
  const [mirrorResult] = await connection.query(
    `INSERT INTO borrow_lend_records
     (user_id, person_name, record_type, amount, record_date, return_date, status, person_user_id, person_phone, person_email, payment_method_id, payment_account, credit_card_id, reflect_in_net, due_alert_enabled, mirror_record_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mirrorUserId,
      payload.ownerName || "Friend",
      mirrorType,
      payload.amount,
      payload.date,
      payload.returnDate || null,
      payload.status || "pending",
      ownerUserId,
      payload.ownerPhone || null,
      payload.ownerEmail || null,
      payload.paymentMethodId || null,
      payload.paymentAccount || null,
      null,
      payload.reflectInNet === false ? 0 : 1,
      payload.dueAlertEnabled === false ? 0 : 1,
      sourceRecordId,
      payload.notes || null,
    ]
  );

  await connection.query(
    "UPDATE borrow_lend_records SET mirror_record_id = ? WHERE id = ?",
    [mirrorResult.insertId, sourceRecordId]
  );

  return mirrorResult.insertId;
}

async function createRecord(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let personUserId = payload.personUserId || null;
    if (!personUserId && (payload.email || payload.phone)) {
      const [matches] = await connection.query(
        `SELECT id, full_name, phone_number, email
         FROM users
         WHERE (? IS NOT NULL AND email = ?)
            OR (? IS NOT NULL AND phone_number = ?)
         LIMIT 1`,
        [payload.email || null, payload.email || null, payload.phone || null, payload.phone || null]
      );

      if (matches[0]) {
        personUserId = matches[0].id;
        payload.personName = matches[0].full_name || payload.personName;
        payload.phone = matches[0].phone_number || payload.phone;
        payload.email = matches[0].email || payload.email;
      }
    }

    const [result] = await connection.query(
      `INSERT INTO borrow_lend_records
       (user_id, person_name, record_type, amount, record_date, return_date, status, person_user_id, person_phone, person_email, payment_method_id, payment_account, credit_card_id, reflect_in_net, due_alert_enabled, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.personName,
        payload.type,
        payload.amount,
        payload.date,
        payload.returnDate || null,
        payload.status || "pending",
        personUserId,
        payload.phone || null,
        payload.email || null,
        payload.paymentMethodId || null,
        payload.paymentAccount || null,
        payload.creditCardId || null,
        payload.reflectInNet === false ? 0 : 1,
        payload.dueAlertEnabled === false ? 0 : 1,
        payload.notes || null,
      ]
    );

    let mirrorRecordId = null;

    if (personUserId) {
      mirrorRecordId = await createMirrorRecord(connection, result.insertId, userId, personUserId, payload);
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

    if (personUserId) {
      await createTimelineEvent(connection, {
        userId: personUserId,
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

async function reconcileGuestRecordsForUser(user) {
  if (!user || !user.id) return;

  const email = user.email || null;
  const phone = user.phone_number || null;
  if (!email && !phone) return;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT blr.id, blr.user_id, blr.person_name, blr.record_type, blr.amount, blr.record_date, blr.return_date, blr.status,
              owner.full_name AS owner_name,
              person_phone, person_email, payment_method_id, payment_account, credit_card_id,
              reflect_in_net, due_alert_enabled, notes
       FROM borrow_lend_records blr
       JOIN users owner ON owner.id = blr.user_id
       WHERE blr.person_user_id IS NULL
         AND blr.mirror_record_id IS NULL
         AND ((? IS NOT NULL AND person_email = ?) OR (? IS NOT NULL AND person_phone = ?))`,
      [email, email, phone, phone]
    );

    for (const row of rows) {
      if (Number(row.user_id) === Number(user.id)) {
        await connection.query(
          `UPDATE borrow_lend_records
           SET person_user_id = ?, person_name = ?, person_phone = ?, person_email = ?
           WHERE id = ?`,
          [user.id, user.full_name || row.person_name, phone, email, row.id]
        );
        continue;
      }

      const mirrorPayload = {
        type: row.record_type,
        amount: Number(row.amount || 0),
        date: row.record_date,
        returnDate: row.return_date || null,
        status: row.status,
        paymentMethodId: row.payment_method_id || null,
        paymentAccount: row.payment_account || null,
        reflectInNet: Boolean(row.reflect_in_net),
        dueAlertEnabled: Boolean(row.due_alert_enabled),
        notes: row.notes || null,
        ownerName: row.owner_name || "Friend",
      };

      const mirrorRecordId = await createMirrorRecord(
        connection,
        row.id,
        row.user_id,
        user.id,
        mirrorPayload
      );

      await connection.query(
        `UPDATE borrow_lend_records
         SET person_user_id = ?, person_name = ?, person_phone = ?, person_email = ?
         WHERE id = ?`,
        [user.id, user.full_name || row.person_name, phone, email, row.id]
      );

      await createTimelineEvent(connection, {
        userId: user.id,
        eventType: TIMELINE_TYPES.BORROW_LEND,
        title: row.record_type === "borrow" ? "Friend borrowed from you" : "Friend lent you money",
        subtitle: row.owner_name || "Friend",
        amount: Number(row.amount || 0),
        eventDate: row.record_date,
        referenceTable: "borrow_lend_records",
        referenceId: mirrorRecordId,
        metadata: {
          sourceRecordId: row.id,
          reconciledGuest: true,
        },
      });
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRecord,
  getRecords,
  reconcileGuestRecordsForUser,
};
