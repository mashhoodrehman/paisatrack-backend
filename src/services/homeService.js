const pool = require("../db/pool");

async function getDashboard(userId) {
  const [[user]] = await pool.query(
    "SELECT full_name, username, monthly_income, income_source, income_profile_type, income_frequency, currency_code FROM users WHERE id = ?",
    [userId]
  );

  const [[expenseSummary]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS monthly_expenses
     FROM expenses
     WHERE user_id = ? AND reflect_in_net = 1 AND MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE())`,
    [userId]
  );

  const [[incomeSummary]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS extra_income
     FROM income_entries
     WHERE user_id = ? AND MONTH(income_date) = MONTH(CURDATE()) AND YEAR(income_date) = YEAR(CURDATE())`,
    [userId]
  );

  const [[borrowSummary]] = await pool.query(
    `SELECT
        COALESCE(SUM(CASE WHEN record_type = 'borrow' AND status != 'paid' AND reflect_in_net = 1 THEN amount ELSE 0 END), 0) AS borrowed,
        COALESCE(SUM(CASE WHEN record_type = 'lend' AND status != 'paid' AND reflect_in_net = 1 THEN amount ELSE 0 END), 0) AS lent
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

  const [[splitSummary]] = await pool.query(
    `SELECT COALESCE(SUM(es.share_amount), 0) AS split_outstanding
     FROM expense_shares es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE es.participant_user_id = ? AND e.reflect_in_net = 1`,
    [userId]
  );

  const [[committeeSummary]] = await pool.query(
    `SELECT COALESCE(SUM(ci.amount), 0) AS committee_total
     FROM committee_installments ci
     INNER JOIN committees c ON c.id = ci.committee_id
     WHERE c.user_id = ? AND ci.reflect_in_net = 1`,
    [userId]
  );

  const [[upcomingBills]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM recurring_payments
     WHERE user_id = ? AND next_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    [userId]
  );

  const recurringIncome =
    user.income_frequency === "monthly" ? Number(user.monthly_income || 0) : 0;
  const totalIncome = recurringIncome + Number(incomeSummary.extra_income || 0);

  const netBalance =
    totalIncome -
    Number(expenseSummary.monthly_expenses || 0) -
    Number(parchiSummary.parchi_outstanding || 0) -
    Number(cardSummary.cards_outstanding || 0) -
    Number(borrowSummary.borrowed || 0) +
    Number(borrowSummary.lent || 0) -
    Number(splitSummary.split_outstanding || 0) -
    Number(committeeSummary.committee_total || 0);

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
    extraIncome: Number(incomeSummary.extra_income || 0),
    incomeSource: user.income_source || "Salary",
    incomeType: user.income_profile_type || "salary",
    incomeCadence: user.income_frequency || "monthly",
    monthlyExpenses: Number(expenseSummary.monthly_expenses || 0),
    borrowedOutstanding: Number(borrowSummary.borrowed || 0),
    lentOutstanding: Number(borrowSummary.lent || 0),
    parchiOutstanding: Number(parchiSummary.parchi_outstanding || 0),
    splitOutstanding: Number(splitSummary.split_outstanding || 0),
    committeeOutstanding: Number(committeeSummary.committee_total || 0),
    cardsOutstanding: Number(cardSummary.cards_outstanding || 0),
    upcomingBillsCount: Number(upcomingBills.count || 0),
    timeline: timeline.map((item) => ({
      ...item,
      metadata: item.metadata_json ? JSON.parse(item.metadata_json) : {},
    })),
  };
}

module.exports = {
  getDashboard,
};
