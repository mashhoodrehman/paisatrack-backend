require("dotenv").config();

const app = require("./app");
const recurringService = require("./services/recurringService");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PaisaTrack PK API listening on port ${PORT}`);
});

async function runRecurringCron() {
  try {
    await recurringService.processAllDueRecurringPayments();
  } catch (error) {
    console.error("Recurring payment cron failed", error);
  }
}

void runRecurringCron();
setInterval(runRecurringCron, 60 * 60 * 1000);
