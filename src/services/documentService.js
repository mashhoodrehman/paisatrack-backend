const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

async function scanDocument(userId, payload) {
  const extractedData = {
    merchantName: payload.extractedMerchantName || "Detected Merchant",
    totalAmount: Number(payload.extractedTotalAmount || 0),
    date: payload.extractedDate || new Date().toISOString().slice(0, 10),
    dueDate: payload.extractedDueDate || null
  };

  const [result] = await pool.query(
    `INSERT INTO scanned_documents
     (user_id, document_type, image_url, extracted_data_json, document_date)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      payload.documentType,
      payload.imageUrl || null,
      JSON.stringify(extractedData),
      extractedData.date
    ]
  );

  await createTimelineEvent(null, {
    userId,
    eventType: TIMELINE_TYPES.DOCUMENT_SCAN,
    title: "Document scanned",
    subtitle: payload.documentType,
    amount: extractedData.totalAmount,
    eventDate: extractedData.date,
    referenceTable: "scanned_documents",
    referenceId: result.insertId,
    metadata: extractedData
  });

  return {
    id: result.insertId,
    extractedData,
    message: "Document scanned successfully"
  };
}

module.exports = {
  scanDocument
};
