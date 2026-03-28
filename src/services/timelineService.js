const pool = require("../db/pool");

async function createTimelineEvent(connection, payload) {
  const executor = connection || pool;

  await executor.query(
    `INSERT INTO financial_timeline
    (user_id, event_type, title, subtitle, amount, event_date, reference_table, reference_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.eventType,
      payload.title,
      payload.subtitle || null,
      payload.amount || 0,
      payload.eventDate,
      payload.referenceTable,
      payload.referenceId,
      JSON.stringify(payload.metadata || {})
    ]
  );
}

module.exports = {
  createTimelineEvent
};
