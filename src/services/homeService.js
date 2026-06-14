const pool = require("../db/pool");

// mysql2 may return JSON columns already parsed (object) or as a string.
function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function getDashboard(userId) {
  const [[user]] = await pool.query(
    "SELECT full_name, username, monthly_income, income_source, income_profile_type, income_frequency, currency_code FROM users WHERE id = ?",
    [userId]
  );

  // Personal expenses only (split expenses are reflected via the cash model below)
  const [[expenseSummary]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS monthly_expenses
     FROM expenses e
     WHERE e.user_id = ? AND e.reflect_in_net = 1
       AND MONTH(e.expense_date) = MONTH(CURDATE()) AND YEAR(e.expense_date) = YEAR(CURDATE())
       AND NOT EXISTS (SELECT 1 FROM expense_shares es WHERE es.expense_id = e.id)`,
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

  // Cash model for splits: out-of-pocket paid is an expense; settlements received are income.
  const [[splitPaidSummary]] = await pool.query(
    `SELECT COALESCE(SUM(es.paid_amount), 0) AS split_paid
     FROM expense_shares es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE es.participant_user_id = ? AND e.reflect_in_net = 1
       AND MONTH(e.expense_date) = MONTH(CURDATE()) AND YEAR(e.expense_date) = YEAR(CURDATE())`,
    [userId]
  );

  const [[settlementSummary]] = await pool.query(
    `SELECT
        COALESCE(SUM(CASE WHEN to_user_id = ? THEN amount ELSE 0 END), 0) AS settlements_received,
        COALESCE(SUM(CASE WHEN from_user_id = ? THEN amount ELSE 0 END), 0) AS settlements_paid
     FROM expense_settlements
     WHERE (to_user_id = ? OR from_user_id = ?)
       AND MONTH(settled_date) = MONTH(CURDATE()) AND YEAR(settled_date) = YEAR(CURDATE())`,
    [userId, userId, userId, userId]
  );

  // Net outstanding the user still owes across all their group splits (cash basis)
  const [[splitOutstandingSummary]] = await pool.query(
    `SELECT
        COALESCE(SUM(es.paid_amount), 0) AS total_paid,
        COALESCE(SUM(es.share_amount), 0) AS total_share
     FROM expense_shares es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE es.participant_user_id = ? AND e.reflect_in_net = 1`,
    [userId]
  );

  // All-time settlements adjust the outstanding balance (creditors receive, debtors pay).
  const [[allSettlements]] = await pool.query(
    `SELECT
        COALESCE(SUM(CASE WHEN to_user_id = ? THEN amount ELSE 0 END), 0) AS received,
        COALESCE(SUM(CASE WHEN from_user_id = ? THEN amount ELSE 0 END), 0) AS paid
     FROM expense_settlements
     WHERE to_user_id = ? OR from_user_id = ?`,
    [userId, userId, userId, userId]
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
  const splitPaid = Number(splitPaidSummary.split_paid || 0);
  const settlementsReceived = Number(settlementSummary.settlements_received || 0);
  const settlementsPaid = Number(settlementSummary.settlements_paid || 0);
  const splitNetOutstanding =
    Number(splitOutstandingSummary.total_paid || 0) -
    Number(splitOutstandingSummary.total_share || 0) -
    Number(allSettlements.received || 0) +
    Number(allSettlements.paid || 0);
  const splitYouOwe = splitNetOutstanding < 0 ? Math.abs(splitNetOutstanding) : 0;
  const splitOwedToYou = splitNetOutstanding > 0 ? splitNetOutstanding : 0;

  const totalIncome =
    recurringIncome + Number(incomeSummary.extra_income || 0) + settlementsReceived;

  const monthlyExpenses =
    Number(expenseSummary.monthly_expenses || 0) + splitPaid + settlementsPaid;

  const netBalance =
    totalIncome -
    monthlyExpenses -
    Number(parchiSummary.parchi_outstanding || 0) -
    Number(cardSummary.cards_outstanding || 0) -
    Number(borrowSummary.borrowed || 0) +
    Number(borrowSummary.lent || 0) -
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
    monthlyExpenses,
    borrowedOutstanding: Number(borrowSummary.borrowed || 0),
    lentOutstanding: Number(borrowSummary.lent || 0),
    parchiOutstanding: Number(parchiSummary.parchi_outstanding || 0),
    splitPaid,
    splitSettlementsReceived: settlementsReceived,
    splitSettlementsPaid: settlementsPaid,
    splitYouOwe,
    splitOwedToYou,
    splitOutstanding: splitYouOwe,
    committeeOutstanding: Number(committeeSummary.committee_total || 0),
    cardsOutstanding: Number(cardSummary.cards_outstanding || 0),
    upcomingBillsCount: Number(upcomingBills.count || 0),
    timeline: timeline.map((item) => ({
      ...item,
      metadata: parseMetadata(item.metadata_json),
    })),
  };
}

module.exports = {
  getDashboard,
};
