const pool = require("../db/pool");

async function getDashboard(userId) {
  const [[user]] = await pool.query(
    "SELECT full_name, monthly_income, currency_code FROM users WHERE id = ?",
    [userId]
  );

  const [[expenseSummary]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS monthly_expenses
     FROM expenses
     WHERE user_id = ? AND MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE())`,
    [userId]
  );

  const [[borrowSummary]] = await pool.query(
    `SELECT
        COALESCE(SUM(CASE WHEN record_type = 'borrow' AND status != 'paid' THEN amount ELSE 0 END), 0) AS borrowed,
        COALESCE(SUM(CASE WHEN record_type = 'lend' AND status != 'paid' THEN amount ELSE 0 END), 0) AS lent
     FROM borrow_lend_records
     WHERE user_id = ?`,
    [userId]
  );

  const [[parchiSummary]] = await pool.query(
    `SELECT COALESCE(SUM(balance_amount), 0) AS parchi_outstanding
     FROM vendor_ledgers
     WHERE user_id = ?`,
    [userId]
  );

  const [[cardSummary]] = await pool.query(
    `SELECT COALESCE(SUM(outstanding_balance), 0) AS cards_outstanding
     FROM credit_cards
     WHERE user_id = ?`,
    [userId]
  );

  const [[upcomingBills]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM recurring_payments
     WHERE user_id = ? AND next_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    [userId]
  );

  const netBalance =
    Number(user.monthly_income || 0) -
    Number(expenseSummary.monthly_expenses || 0) -
    Number(parchiSummary.parchi_outstanding || 0) -
    Number(cardSummary.cards_outstanding || 0) -
    Number(borrowSummary.borrowed || 0) +
    Number(borrowSummary.lent || 0);

  const [timeline] = await pool.query(
    `SELECT id, event_type, title, subtitle, amount, event_date, metadata_json
     FROM financial_timeline
     WHERE user_id = ?
     ORDER BY event_date DESC, id DESC
     LIMIT 25`,
    [userId]
  );

  return {
    greeting: `Assalam o Alaikum, ${user.full_name}`,
    currencyCode: user.currency_code,
    netBalance,
    monthlyIncome: Number(user.monthly_income || 0),
    monthlyExpenses: Number(expenseSummary.monthly_expenses || 0),
    borrowedOutstanding: Number(borrowSummary.borrowed || 0),
    lentOutstanding: Number(borrowSummary.lent || 0),
    parchiOutstanding: Number(parchiSummary.parchi_outstanding || 0),
    cardsOutstanding: Number(cardSummary.cards_outstanding || 0),
    upcomingBillsCount: Number(upcomingBills.count || 0),
    timeline: timeline.map((item) => ({
      ...item,
      metadata: item.metadata_json ? JSON.parse(item.metadata_json) : {}
    }))
  };
}

module.exports = {
  getDashboard
};
