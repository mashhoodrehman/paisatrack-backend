const pool = require("../db/pool");

async function getReports(userId) {
  const [categorySpend] = await pool.query(
    `SELECT c.name, COALESCE(SUM(e.amount), 0) AS total
     FROM categories c
     LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = ?
     GROUP BY c.id, c.name
     HAVING total > 0
     ORDER BY total DESC`,
    [userId]
  );

  const [paymentMethodSpend] = await pool.query(
    `SELECT pm.name, COALESCE(SUM(e.amount), 0) AS total
     FROM payment_methods pm
     LEFT JOIN expenses e ON e.payment_method_id = pm.id AND e.user_id = ?
     GROUP BY pm.id, pm.name
     HAVING total > 0
     ORDER BY total DESC`,
    [userId]
  );

  const [[summary]] = await pool.query(
    `SELECT
      (SELECT COALESCE(monthly_income, 0) FROM users WHERE id = ?) AS income,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = ?) AS expenses,
      (SELECT COALESCE(SUM(CASE WHEN record_type = 'borrow' AND status != 'paid' THEN amount ELSE 0 END), 0) FROM borrow_lend_records WHERE user_id = ?) AS borrowed,
      (SELECT COALESCE(SUM(CASE WHEN record_type = 'lend' AND status != 'paid' THEN amount ELSE 0 END), 0) FROM borrow_lend_records WHERE user_id = ?) AS lent,
      (SELECT COALESCE(SUM(balance_amount), 0) FROM vendor_ledgers WHERE user_id = ?) AS outstandingParchi`,
    [userId, userId, userId, userId, userId]
  );

  return {
    categorySpend,
    paymentMethodSpend,
    summary: {
      ...summary,
      savings: Number(summary.income || 0) - Number(summary.expenses || 0)
    }
  };
}

module.exports = {
  getReports
};
