const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createRecord(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO borrow_lend_records
     (user_id, person_name, record_type, amount, record_date, return_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.personName,
      payload.type,
      payload.amount,
      payload.date,
      payload.returnDate || null,
      payload.status || "pending",
      payload.notes || null
    ]
  );

  await createTimelineEvent(null, {
    userId,
    eventType: TIMELINE_TYPES.BORROW_LEND,
    title: payload.type === "borrow" ? "Money borrowed" : "Money lent",
    subtitle: payload.personName,
    amount: payload.amount,
    eventDate: payload.date,
    referenceTable: "borrow_lend_records",
    referenceId: result.insertId,
    metadata: payload
  });

  return { id: result.insertId, message: "Borrow/lend record created successfully" };
}

async function getRecords(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM borrow_lend_records WHERE user_id = ? ORDER BY record_date DESC, id DESC",
    [userId]
  );
  return rows;
}

module.exports = {
  createRecord,
  getRecords
};
