const pool = require("../db/pool");

async function getReports(userId) {
  const [categorySpend] = await pool.query(
    `SELECT c.name, COALESCE(SUM(e.amount), 0) AS total
     FROM categories c
     LEFT JOIN expenses e
       ON e.category_id = c.id AND e.user_id = ? AND e.reflect_in_net = 1
     GROUP BY c.id, c.name
     HAVING total > 0
     ORDER BY total DESC`,
    [userId]
  );

  const [paymentMethodSpend] = await pool.query(
    `SELECT pm.name, COALESCE(SUM(e.amount), 0) AS total
     FROM payment_methods pm
     LEFT JOIN expenses e
       ON e.payment_method_id = pm.id AND e.user_id = ?
     GROUP BY pm.id, pm.name
     HAVING total > 0
     ORDER BY total DESC`,
    [userId]
  );

  const [[summary]] = await pool.query(
    `SELECT
      (SELECT CASE WHEN income_frequency = 'monthly' THEN COALESCE(monthly_income, 0) ELSE 0 END FROM users WHERE id = ?) +
      (SELECT COALESCE(SUM(amount), 0) FROM income_entries WHERE user_id = ?) AS income,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = ? AND reflect_in_net = 1) AS expenses,
      (SELECT COALESCE(SUM(CASE WHEN record_type = 'borrow' AND status != 'paid' AND reflect_in_net = 1 THEN amount ELSE 0 END), 0) FROM borrow_lend_records WHERE user_id = ?) AS borrowed,
      (SELECT COALESCE(SUM(CASE WHEN record_type = 'lend' AND status != 'paid' AND reflect_in_net = 1 THEN amount ELSE 0 END), 0) FROM borrow_lend_records WHERE user_id = ?) AS lent,
      (SELECT COALESCE(SUM(balance_amount), 0) FROM vendor_ledgers WHERE user_id = ?) AS outstandingParchi,
      (SELECT COALESCE(SUM(share_amount), 0)
         FROM expense_shares es
         INNER JOIN expenses e ON e.id = es.expense_id
         WHERE es.participant_user_id = ? AND e.reflect_in_net = 1) AS splitwise,
      (SELECT COALESCE(SUM(amount), 0)
         FROM committee_installments ci
         INNER JOIN committees c ON c.id = ci.committee_id
         WHERE c.user_id = ? AND ci.reflect_in_net = 1) AS committee`,
    [userId, userId, userId, userId, userId, userId, userId, userId]
  );

  const income = Number(summary.income || 0);
  const expenses = Number(summary.expenses || 0);
  const borrowed = Number(summary.borrowed || 0);
  const lent = Number(summary.lent || 0);
  const parchi = Number(summary.outstandingParchi || 0);
  const splitwise = Number(summary.splitwise || 0);
  const committee = Number(summary.committee || 0);

  return {
    categorySpend,
    paymentMethodSpend,
    summary: {
      ...summary,
      savings: income - expenses - borrowed + lent - parchi - splitwise - committee,
    },
  };
}

module.exports = {
  getReports,
};
