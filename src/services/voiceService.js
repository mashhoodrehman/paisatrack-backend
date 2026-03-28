const pool = require("../db/pool");
const { TIMELINE_TYPES } = require("../config/constants");
const { createTimelineEvent } = require("./timelineService");

function parseVoiceCommand(command) {
  const text = command.toLowerCase();

  if (text.includes("borrowed")) {
    const amountMatch = text.match(/borrowed\s+(\d+)/);
    const personMatch = text.match(/from\s+([a-z\s]+)/);
    return {
      type: "borrow_lend",
      parsed: {
        action: "borrow",
        amount: amountMatch ? Number(amountMatch[1]) : 0,
        personName: personMatch ? personMatch[1].trim() : ""
      }
    };
  }

  if (text.includes("split")) {
    const amountMatch = text.match(/(\d+)/);
    return {
      type: "split_expense",
      parsed: {
        amount: amountMatch ? Number(amountMatch[1]) : 0,
        summary: command
      }
    };
  }

  if (text.includes("committee")) {
    const amountMatch = text.match(/(\d+)/);
    return {
      type: "committee_installment",
      parsed: {
        amount: amountMatch ? Number(amountMatch[1]) : 0,
        summary: command
      }
    };
  }

  if (text.includes("parchi")) {
    const amountMatch = text.match(/(\d+)/);
    return {
      type: "parchi",
      parsed: {
        amount: amountMatch ? Number(amountMatch[1]) : 0,
        summary: command
      }
    };
  }

  const amountMatch = text.match(/(\d+)/);
  return {
    type: "expense",
    parsed: {
      amount: amountMatch ? Number(amountMatch[1]) : 0,
      summary: command
    }
  };
}

async function handleVoiceCommand(userId, command) {
  const parsedResult = parseVoiceCommand(command);

  const [result] = await pool.query(
    `INSERT INTO voice_records
     (user_id, raw_command, parsed_result_json)
     VALUES (?, ?, ?)`,
    [userId, command, JSON.stringify(parsedResult)]
  );

  await createTimelineEvent(null, {
    userId,
    eventType: TIMELINE_TYPES.VOICE_RECORD,
    title: "Voice record created",
    subtitle: parsedResult.type,
    amount: parsedResult.parsed.amount || 0,
    eventDate: new Date().toISOString().slice(0, 19).replace("T", " "),
    referenceTable: "voice_records",
    referenceId: result.insertId,
    metadata: parsedResult
  });

  return {
    id: result.insertId,
    parsedResult
  };
}

module.exports = {
  handleVoiceCommand
};
