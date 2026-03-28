const pool = require("../db/pool");

async function createGroup(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO expense_groups (user_id, name, description) VALUES (?, ?, ?)",
      [userId, payload.name, payload.description || null]
    );

    const members = payload.members || [];
    for (const member of members) {
      await connection.query(
        `INSERT INTO expense_group_members
         (group_id, member_name, member_phone, member_email)
         VALUES (?, ?, ?, ?)`,
        [result.insertId, member.name, member.phone || null, member.email || null]
      );
    }

    await connection.commit();
    return { id: result.insertId, message: "Group created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getGroups(userId) {
  const [groups] = await pool.query(
    `SELECT g.*,
        (SELECT COUNT(*) FROM expense_group_members gm WHERE gm.group_id = g.id) AS member_count
     FROM expense_groups g
     WHERE g.user_id = ?
     ORDER BY g.id DESC`,
    [userId]
  );

  return groups;
}

async function getGroupExpenses(groupId) {
  const [rows] = await pool.query(
    `SELECT e.id, e.amount, e.expense_date, e.notes
     FROM expenses e
     WHERE e.group_id = ?
     ORDER BY e.expense_date DESC, e.id DESC`,
    [groupId]
  );
  return rows;
}

async function getGroupSettlement(groupId) {
  const [rows] = await pool.query(
    `SELECT es.participant_name,
            SUM(es.share_amount) AS total_share,
            SUM(es.paid_amount) AS total_paid
     FROM expense_shares es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = ?
     GROUP BY es.participant_name`,
    [groupId]
  );

  const balances = rows.map((row) => ({
    participantName: row.participant_name,
    totalShare: Number(row.total_share || 0),
    totalPaid: Number(row.total_paid || 0),
    netBalance: Number(row.total_paid || 0) - Number(row.total_share || 0)
  }));

  const creditors = balances
    .filter((item) => item.netBalance > 0)
    .map((item) => ({ ...item, remaining: item.netBalance }));
  const debtors = balances
    .filter((item) => item.netBalance < 0)
    .map((item) => ({ ...item, remaining: Math.abs(item.netBalance) }));

  const suggestions = [];

  for (const debtor of debtors) {
    for (const creditor of creditors) {
      if (debtor.remaining <= 0) {
        break;
      }
      if (creditor.remaining <= 0) {
        continue;
      }

      const amount = Math.min(debtor.remaining, creditor.remaining);
      suggestions.push({
        from: debtor.participantName,
        to: creditor.participantName,
        amount
      });

      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }
  }

  return {
    balances,
    suggestions
  };
}

module.exports = {
  createGroup,
  getGroups,
  getGroupExpenses,
  getGroupSettlement
};
