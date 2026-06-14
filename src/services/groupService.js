const pool = require("../db/pool");
const ApiError = require("../utils/ApiError");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");
const { sendGroupInviteMail } = require("./mailService");

function memberKey(userId, name) {
  if (userId) return `u:${userId}`;
  return `n:${String(name || "").trim().toLowerCase()}`;
}

async function resolveUser(executor, { userId, email, phone, username }) {
  if (userId) return Number(userId);
  if (!email && !phone && !username) return null;

  const [matches] = await executor.query(
    `SELECT id FROM users
     WHERE (? IS NOT NULL AND email = ?)
        OR (? IS NOT NULL AND phone_number = ?)
        OR (? IS NOT NULL AND username = ?)
     LIMIT 1`,
    [
      email || null,
      email || null,
      phone || null,
      phone || null,
      username || null,
      username || null,
    ]
  );

  return matches[0]?.id || null;
}

async function createGroup(userId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[owner]] = await connection.query(
      "SELECT full_name, email, phone_number FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    const [result] = await connection.query(
      "INSERT INTO expense_groups (user_id, name, description) VALUES (?, ?, ?)",
      [userId, payload.name, payload.description || null]
    );
    const groupId = result.insertId;

    // The owner is always a member of their own group
    await connection.query(
      `INSERT INTO expense_group_members
       (group_id, member_name, member_phone, member_email, user_id, is_registered, invite_status, is_owner)
       VALUES (?, ?, ?, ?, ?, 1, 'accepted', 1)`,
      [groupId, owner?.full_name || "Me", owner?.phone_number || null, owner?.email || null, userId]
    );

    const invitedEmails = [];
    const members = Array.isArray(payload.members) ? payload.members : [];

    for (const member of members) {
      if (!member || !(member.name || member.email || member.phone)) continue;

      const resolvedUserId = await resolveUser(connection, {
        userId: member.userId,
        email: member.email,
        phone: member.phone,
        username: member.username,
      });

      // Skip duplicating the owner
      if (resolvedUserId && Number(resolvedUserId) === Number(userId)) continue;

      const isRegistered = resolvedUserId ? 1 : 0;
      const inviteStatus = resolvedUserId ? "accepted" : member.email ? "invited" : "none";

      await connection.query(
        `INSERT INTO expense_group_members
         (group_id, member_name, member_phone, member_email, user_id, is_registered, invite_status, is_owner)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          groupId,
          member.name || member.email || member.phone,
          member.phone || null,
          member.email || null,
          resolvedUserId,
          isRegistered,
          inviteStatus,
        ]
      );

      if (!resolvedUserId && member.email) {
        invitedEmails.push(member.email);
      }
    }

    await connection.commit();

    // Fire invite emails outside the transaction
    for (const email of invitedEmails) {
      try {
        await sendGroupInviteMail(email, {
          ownerName: owner?.full_name || "Someone",
          groupName: payload.name,
        });
      } catch (error) {
        console.error("Failed to send group invite", error);
      }
    }

    return { id: groupId, invitedEmails, message: "Group created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Build per-member balances for a group, including settlements.
async function buildGroupBalances(executor, groupId) {
  const [members] = await executor.query(
    `SELECT id, member_name, member_phone, member_email, user_id, is_registered, invite_status, is_owner
     FROM expense_group_members
     WHERE group_id = ?
     ORDER BY is_owner DESC, id ASC`,
    [groupId]
  );

  const [shares] = await executor.query(
    `SELECT es.participant_name, es.participant_user_id, es.participant_email,
            es.share_amount, es.paid_amount
     FROM expense_shares es
     INNER JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = ? AND e.reflect_in_net = 1`,
    [groupId]
  );

  const [settlements] = await executor.query(
    `SELECT from_user_id, from_name, to_user_id, to_name, amount
     FROM expense_settlements
     WHERE group_id = ?`,
    [groupId]
  );

  const map = new Map();
  const ensure = (userId, name, email) => {
    const key = memberKey(userId, name);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: name || "Member",
        userId: userId ? Number(userId) : null,
        email: email || null,
        paid: 0,
        share: 0,
        received: 0,
        settledPaid: 0,
      });
    }
    const entry = map.get(key);
    if (!entry.userId && userId) entry.userId = Number(userId);
    if (!entry.email && email) entry.email = email;
    return entry;
  };

  for (const member of members) {
    ensure(member.user_id, member.member_name, member.member_email);
  }

  for (const share of shares) {
    const entry = ensure(share.participant_user_id, share.participant_name, share.participant_email);
    entry.paid += Number(share.paid_amount || 0);
    entry.share += Number(share.share_amount || 0);
  }

  for (const settlement of settlements) {
    const fromEntry = ensure(settlement.from_user_id, settlement.from_name);
    const toEntry = ensure(settlement.to_user_id, settlement.to_name);
    fromEntry.settledPaid += Number(settlement.amount || 0);
    toEntry.received += Number(settlement.amount || 0);
  }

  const balances = Array.from(map.values()).map((entry) => ({
    name: entry.name,
    userId: entry.userId,
    email: entry.email,
    paid: Number(entry.paid.toFixed(2)),
    share: Number(entry.share.toFixed(2)),
    received: Number(entry.received.toFixed(2)),
    settledPaid: Number(entry.settledPaid.toFixed(2)),
    // balance > 0 => this member is owed money (creditor)
    balance: Number(((entry.paid - entry.share) - entry.received + entry.settledPaid).toFixed(2)),
  }));

  return { members, balances };
}

// Greedy settlement suggestions from balances (who pays whom).
function buildSuggestions(balances) {
  const creditors = balances
    .filter((item) => item.balance > 0.01)
    .map((item) => ({ ...item, remaining: item.balance }));
  const debtors = balances
    .filter((item) => item.balance < -0.01)
    .map((item) => ({ ...item, remaining: Math.abs(item.balance) }));

  const suggestions = [];
  for (const debtor of debtors) {
    for (const creditor of creditors) {
      if (debtor.remaining <= 0.01) break;
      if (creditor.remaining <= 0.01) continue;

      const amount = Number(Math.min(debtor.remaining, creditor.remaining).toFixed(2));
      if (amount <= 0.01) continue;

      suggestions.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount,
      });

      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }
  }

  return suggestions;
}

function viewerSummary(balances, suggestions, userId) {
  const me = balances.find((item) => item.userId && Number(item.userId) === Number(userId));
  const myBalance = me ? me.balance : 0;

  const myDebts = suggestions
    .filter((item) => item.fromUserId && Number(item.fromUserId) === Number(userId))
    .map((item) => ({ name: item.toName, userId: item.toUserId, amount: item.amount }));
  const myCredits = suggestions
    .filter((item) => item.toUserId && Number(item.toUserId) === Number(userId))
    .map((item) => ({ name: item.fromName, userId: item.fromUserId, amount: item.amount }));

  return {
    net: myBalance,
    youOwe: myBalance < 0 ? Math.abs(myBalance) : 0,
    owedToYou: myBalance > 0 ? myBalance : 0,
    myPaid: me ? me.paid : 0,
    myShare: me ? me.share : 0,
    mySettlementsReceived: me ? me.received : 0,
    mySettlementsPaid: me ? me.settledPaid : 0,
    myDebts,
    myCredits,
  };
}

async function getGroups(userId) {
  const [groups] = await pool.query(
    `SELECT DISTINCT g.id, g.user_id, g.name, g.description, g.created_at
     FROM expense_groups g
     LEFT JOIN expense_group_members gm ON gm.group_id = g.id
     WHERE g.user_id = ? OR gm.user_id = ?
     ORDER BY g.id DESC`,
    [userId, userId]
  );

  const result = [];
  for (const group of groups) {
    const { members, balances } = await buildGroupBalances(pool, group.id);
    const suggestions = buildSuggestions(balances);
    const summary = viewerSummary(balances, suggestions, userId);

    result.push({
      id: group.id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      isOwner: Number(group.user_id) === Number(userId),
      members: members.map((m) => ({
        id: m.id,
        name: m.member_name,
        phone: m.member_phone,
        email: m.member_email,
        userId: m.user_id ? Number(m.user_id) : null,
        isRegistered: Boolean(m.is_registered),
        isOwner: Boolean(m.is_owner),
        inviteStatus: m.invite_status,
      })),
      balances,
      ...summary,
    });
  }

  return result;
}

async function getGroupDetail(userId, groupId) {
  const [[group]] = await pool.query(
    `SELECT id, user_id, name, description, created_at FROM expense_groups WHERE id = ? LIMIT 1`,
    [groupId]
  );

  if (!group) {
    throw new ApiError(404, "Group not found");
  }

  const { members, balances } = await buildGroupBalances(pool, groupId);
  const suggestions = buildSuggestions(balances);
  const summary = viewerSummary(balances, suggestions, userId);

  const [expenseRows] = await pool.query(
    `SELECT e.id, e.amount, e.expense_date, e.notes, e.reflect_in_net, e.user_id,
            owner.full_name AS owner_name, c.name AS category_name
     FROM expenses e
     LEFT JOIN users owner ON owner.id = e.user_id
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.group_id = ?
     ORDER BY e.expense_date DESC, e.id DESC`,
    [groupId]
  );

  const expenses = [];
  for (const row of expenseRows) {
    const [shares] = await pool.query(
      `SELECT participant_name, participant_user_id, share_amount, paid_amount
       FROM expense_shares
       WHERE expense_id = ?`,
      [row.id]
    );

    const payer = shares
      .slice()
      .sort((a, b) => Number(b.paid_amount) - Number(a.paid_amount))[0];

    expenses.push({
      id: row.id,
      title: row.notes || row.category_name || "Split expense",
      amount: Number(row.amount || 0),
      date: row.expense_date,
      ownerName: row.owner_name,
      ownerUserId: row.user_id ? Number(row.user_id) : null,
      createdByMe: Number(row.user_id) === Number(userId),
      reflectInNet: row.reflect_in_net !== 0,
      paidByName: payer?.participant_name || row.owner_name,
      shares: shares.map((s) => ({
        name: s.participant_name,
        userId: s.participant_user_id ? Number(s.participant_user_id) : null,
        shareAmount: Number(s.share_amount || 0),
        paidAmount: Number(s.paid_amount || 0),
      })),
    });
  }

  const [settlementRows] = await pool.query(
    `SELECT id, from_user_id, from_name, to_user_id, to_name, amount, settled_date
     FROM expense_settlements
     WHERE group_id = ?
     ORDER BY settled_date DESC, id DESC`,
    [groupId]
  );

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    created_at: group.created_at,
    isOwner: Number(group.user_id) === Number(userId),
    members: members.map((m) => ({
      id: m.id,
      name: m.member_name,
      phone: m.member_phone,
      email: m.member_email,
      userId: m.user_id ? Number(m.user_id) : null,
      isRegistered: Boolean(m.is_registered),
      isOwner: Boolean(m.is_owner),
      inviteStatus: m.invite_status,
    })),
    balances,
    suggestions,
    expenses,
    settlements: settlementRows.map((s) => ({
      id: s.id,
      fromName: s.from_name,
      fromUserId: s.from_user_id ? Number(s.from_user_id) : null,
      toName: s.to_name,
      toUserId: s.to_user_id ? Number(s.to_user_id) : null,
      amount: Number(s.amount || 0),
      date: s.settled_date,
    })),
    ...summary,
  };
}

async function addMembers(userId, groupId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[group]] = await connection.query(
      "SELECT id, name, user_id FROM expense_groups WHERE id = ? LIMIT 1",
      [groupId]
    );
    if (!group) throw new ApiError(404, "Group not found");

    const [[owner]] = await connection.query(
      "SELECT full_name FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    const members = Array.isArray(payload.members) ? payload.members : [];
    const invitedEmails = [];

    for (const member of members) {
      if (!member || !(member.name || member.email || member.phone)) continue;

      const resolvedUserId = await resolveUser(connection, {
        userId: member.userId,
        email: member.email,
        phone: member.phone,
        username: member.username,
      });

      const [existing] = await connection.query(
        `SELECT id FROM expense_group_members
         WHERE group_id = ?
           AND ((? IS NOT NULL AND user_id = ?)
                OR (? IS NOT NULL AND member_email = ?))
         LIMIT 1`,
        [groupId, resolvedUserId, resolvedUserId, member.email || null, member.email || null]
      );
      if (existing.length) continue;

      const isRegistered = resolvedUserId ? 1 : 0;
      const inviteStatus = resolvedUserId ? "accepted" : member.email ? "invited" : "none";

      await connection.query(
        `INSERT INTO expense_group_members
         (group_id, member_name, member_phone, member_email, user_id, is_registered, invite_status, is_owner)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          groupId,
          member.name || member.email || member.phone,
          member.phone || null,
          member.email || null,
          resolvedUserId,
          isRegistered,
          inviteStatus,
        ]
      );

      if (!resolvedUserId && member.email) invitedEmails.push(member.email);
    }

    await connection.commit();

    for (const email of invitedEmails) {
      try {
        await sendGroupInviteMail(email, {
          ownerName: owner?.full_name || "Someone",
          groupName: group.name,
        });
      } catch (error) {
        console.error("Failed to send group invite", error);
      }
    }

    return { id: Number(groupId), invitedEmails, message: "Members added" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function settleUp(userId, groupId, payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[group]] = await connection.query(
      "SELECT id, name FROM expense_groups WHERE id = ? LIMIT 1",
      [groupId]
    );
    if (!group) throw new ApiError(404, "Group not found");

    const amount = Number(payload.amount || 0);
    if (!amount || amount <= 0) {
      throw new ApiError(400, "Settlement amount is required");
    }

    const fromUserId = payload.fromUserId
      ? Number(payload.fromUserId)
      : await resolveUser(connection, { email: payload.fromEmail, phone: payload.fromPhone });
    const toUserId = payload.toUserId
      ? Number(payload.toUserId)
      : await resolveUser(connection, { email: payload.toEmail, phone: payload.toPhone });

    const settledDate = payload.date || new Date().toISOString().slice(0, 10);

    const [result] = await connection.query(
      `INSERT INTO expense_settlements
       (group_id, expense_id, from_user_id, from_name, to_user_id, to_name, amount, settled_date, recorded_by_user_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        groupId,
        payload.expenseId || null,
        fromUserId,
        payload.fromName || null,
        toUserId,
        payload.toName || null,
        amount,
        settledDate,
        userId,
        payload.notes || null,
      ]
    );

    // Reflect for the payer (cash out -> expense) and receiver (cash in -> income)
    if (fromUserId) {
      await createTimelineEvent(connection, {
        userId: fromUserId,
        eventType: TIMELINE_TYPES.SPLIT_EXPENSE,
        title: "Split settlement paid",
        subtitle: `${payload.toName || "Group member"} - ${group.name}`,
        amount,
        eventDate: settledDate,
        referenceTable: "expense_settlements",
        referenceId: result.insertId,
        metadata: { settlement: true, direction: "paid", groupId: Number(groupId) },
      });
    }

    if (toUserId) {
      await createTimelineEvent(connection, {
        userId: toUserId,
        eventType: TIMELINE_TYPES.SPLIT_EXPENSE,
        title: "Split settlement received",
        subtitle: `${payload.fromName || "Group member"} - ${group.name}`,
        amount,
        eventDate: settledDate,
        referenceTable: "expense_settlements",
        referenceId: result.insertId,
        metadata: { settlement: true, direction: "received", groupId: Number(groupId) },
      });
    }

    await connection.commit();

    return { id: result.insertId, amount, message: "Settlement recorded" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteGroup(userId, groupId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[group]] = await connection.query(
      "SELECT id, user_id FROM expense_groups WHERE id = ? LIMIT 1",
      [groupId]
    );
    if (!group) throw new ApiError(404, "Group not found");
    if (Number(group.user_id) !== Number(userId)) {
      throw new ApiError(403, "Only the group owner can delete this group");
    }

    // expenses.group_id is ON DELETE SET NULL, so remove the group's expenses
    // explicitly (this cascades expense_shares) instead of orphaning them.
    const [expenseRows] = await connection.query(
      "SELECT id FROM expenses WHERE group_id = ?",
      [groupId]
    );
    const expenseIds = expenseRows.map((row) => row.id);

    if (expenseIds.length) {
      await connection.query(
        "DELETE FROM financial_timeline WHERE reference_table = 'expenses' AND reference_id IN (?)",
        [expenseIds]
      );
      await connection.query("DELETE FROM expenses WHERE group_id = ?", [groupId]);
    }

    await connection.query(
      "DELETE FROM financial_timeline WHERE reference_table = 'expense_settlements' AND reference_id IN (SELECT id FROM expense_settlements WHERE group_id = ?)",
      [groupId]
    );
    await connection.query("DELETE FROM expense_groups WHERE id = ?", [groupId]);

    await connection.commit();
    return { id: Number(groupId), message: "Group deleted" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// When a guest signs up, link their group memberships + expense shares to their account.
async function reconcileGroupMembershipsForUser(user) {
  if (!user || !user.id) return;

  const email = user.email || null;
  const phone = user.phone_number || null;
  if (!email && !phone) return;

  await pool.query(
    `UPDATE expense_group_members
     SET user_id = ?, is_registered = 1, invite_status = 'accepted'
     WHERE user_id IS NULL
       AND ((? IS NOT NULL AND member_email = ?) OR (? IS NOT NULL AND member_phone = ?))`,
    [user.id, email, email, phone, phone]
  );

  await pool.query(
    `UPDATE expense_shares
     SET participant_user_id = ?, is_registered = 1, invite_status = 'accepted'
     WHERE participant_user_id IS NULL
       AND ((? IS NOT NULL AND participant_email = ?) OR (? IS NOT NULL AND participant_phone = ?))`,
    [user.id, email, email, phone, phone]
  );
}

module.exports = {
  createGroup,
  getGroups,
  getGroupDetail,
  addMembers,
  settleUp,
  deleteGroup,
  reconcileGroupMembershipsForUser,
};
