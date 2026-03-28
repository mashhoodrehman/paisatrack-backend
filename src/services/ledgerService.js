const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createVendor(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO vendor_ledgers
     (user_id, vendor_name, vendor_phone, balance_amount)
     VALUES (?, ?, ?, ?)`,
    [userId, payload.vendorName, payload.vendorPhone || null, 0]
  );

  return { id: result.insertId, message: "Vendor ledger created successfully" };
}

async function createEntry(userId, vendorId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const amountDelta = payload.entryType === "purchase" ? payload.amount : -payload.amount;

    const [entryResult] = await connection.query(
      `INSERT INTO vendor_ledger_entries
       (vendor_ledger_id, entry_type, amount, entry_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vendorId, payload.entryType, payload.amount, payload.date, payload.status || "unpaid", payload.notes || null]
    );

    await connection.query(
      `UPDATE vendor_ledgers vl
       SET balance_amount = balance_amount + ?
       WHERE vl.id = ? AND vl.user_id = ?`,
      [amountDelta, vendorId, userId]
    );

    await createTimelineEvent(connection, {
      userId,
      eventType: TIMELINE_TYPES.PARCHI,
      title: "Parchi record added",
      subtitle: payload.notes || "Khata entry created",
      amount: payload.amount,
      eventDate: payload.date,
      referenceTable: "vendor_ledger_entries",
      referenceId: entryResult.insertId,
      metadata: payload
    });

    await connection.commit();
    return { id: entryResult.insertId, message: "Ledger entry added successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getVendors(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM vendor_ledgers WHERE user_id = ? ORDER BY vendor_name",
    [userId]
  );
  return rows;
}

async function getVendorEntries(vendorId) {
  const [rows] = await pool.query(
    `SELECT * FROM vendor_ledger_entries
     WHERE vendor_ledger_id = ?
     ORDER BY entry_date DESC, id DESC`,
    [vendorId]
  );
  return rows;
}

module.exports = {
  createVendor,
  createEntry,
  getVendors,
  getVendorEntries
};
