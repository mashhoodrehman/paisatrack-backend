const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function createVendor(userId, payload) {
  const [result] = await pool.query(
    `INSERT INTO vendor_ledgers
     (user_id, vendor_name, vendor_phone, balance_amount, reflect_in_net_by_default, invoice_logo_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.vendorName,
      payload.vendorPhone || null,
      0,
      payload.reflectInNetByDefault === false ? 0 : 1,
      payload.invoiceLogoUrl || null,
    ]
  );
  return { id: result.insertId, message: "Vendor ledger created successfully" };
}

async function createEntry(userId, vendorId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[vendor]] = await connection.query(
      "SELECT * FROM vendor_ledgers WHERE id = ? AND user_id = ?",
      [vendorId, userId]
    );

    const reflectInNet =
      payload.reflectInNet === undefined
        ? Number(vendor?.reflect_in_net_by_default || 1)
        : payload.reflectInNet
        ? 1
        : 0;

    const [result] = await connection.query(
      `INSERT INTO vendor_ledger_entries
       (vendor_ledger_id, entry_type, amount, entry_date, status, quantity, payment_method_id, payment_account, credit_card_id, reflect_in_net, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId,
        payload.entryType || "purchase",
        payload.amount,
        payload.date,
        payload.status || "unpaid",
        payload.quantity || 1,
        payload.paymentMethodId || null,
        payload.paymentAccount || null,
        payload.creditCardId || null,
        reflectInNet,
        payload.notes || null,
      ]
    );

    const amountDelta = payload.entryType === "payment" || payload.status === "paid"
      ? -Number(payload.amount || 0)
      : Number(payload.amount || 0);

    await connection.query(
      `UPDATE vendor_ledgers vl
       SET vl.balance_amount = GREATEST(vl.balance_amount + ?, 0)
       WHERE vl.id = ? AND vl.user_id = ?`,
      [amountDelta, vendorId, userId]
    );

    await createTimelineEvent(connection, {
      userId,
      eventType: TIMELINE_TYPES.PARCHI,
      title: payload.entryType === "payment" ? "Parchi payment recorded" : "Parchi entry recorded",
      subtitle: vendor?.vendor_name || "Vendor ledger",
      amount: payload.amount,
      eventDate: payload.date,
      referenceTable: "vendor_ledger_entries",
      referenceId: result.insertId,
      metadata: payload,
    });

    await connection.commit();

    return { id: result.insertId, message: "Vendor entry created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getVendors(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM vendor_ledgers WHERE user_id = ? ORDER BY vendor_name`,
    [userId]
  );
  return rows;
}

async function getVendorEntries(vendorId) {
  const [rows] = await pool.query(
    `SELECT vle.*, pm.name AS payment_method_name
     FROM vendor_ledger_entries vle
     LEFT JOIN payment_methods pm ON pm.id = vle.payment_method_id
     WHERE vle.vendor_ledger_id = ?
     ORDER BY vle.entry_date DESC, vle.id DESC`,
    [vendorId]
  );
  return rows;
}

module.exports = {
  createVendor,
  createEntry,
  getVendors,
  getVendorEntries,
};
