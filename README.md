# PaisaTrack PK Backend

Node.js + Express + MySQL backend for the PaisaTrack PK mobile fintech application, organized in a clean MVC structure.

## Stack

- Node.js
- Express
- MySQL
- JWT authentication
- MVC architecture

## Project Structure

```text
src/
  app.js
  server.js
  config/
  controllers/
  db/
  middlewares/
  routes/
  services/
  utils/
database/
  schema.sql
  seed.sql
postman/
  PaisaTrack-PK.postman_collection.json
```

## MVC Design

- `routes/`: HTTP endpoints only
- `controllers/`: request and response handling
- `services/`: business logic and SQL orchestration
- `db/`: database connection pool
- `middlewares/`: auth and error handling
- `utils/`: shared helpers

## Features Covered

- OTP and Google-style login flow
- User setup and settings
- Home dashboard with unified financial timeline
- Personal expenses and Splitwise-style split expense support
- Expense groups and settlement summaries
- Borrow and lend records
- Parchi / khata ledgers
- Recurring payments with reminders
- Committee / beesi tracking
- Document scan storage with OCR-ready extracted fields
- Voice command parsing endpoint
- Reports for categories, payment methods, and financial summaries
- Credit card management, transactions, and bill payments

## Setup

1. Copy `.env.example` to `.env`
2. Create the database and tables:

```sql
SOURCE database/schema.sql;
SOURCE database/seed.sql;
```

3. Install packages:

```bash
npm install
```

4. Start the API:

```bash
npm run dev
```

## Main API Groups

- `/api/auth`
- `/api/users`
- `/api/master-data`
- `/api/home`
- `/api/expenses`
- `/api/groups`
- `/api/borrow-lend`
- `/api/ledger`
- `/api/recurring`
- `/api/committees`
- `/api/documents`
- `/api/voice`
- `/api/reports`
- `/api/cards`

## Important Notes

- OTP is mocked as `123456` for local development.
- OCR and voice AI are scaffolded with clean endpoints and placeholder parsing so you can later plug in a real OCR or speech/NLP provider without changing the mobile contract much.
- The backend is designed to support the UI flows you described, not just isolated CRUD tables.

## PM2 and ngrok

You can manage both the API and ngrok together with PM2.

Start:

```bash
./scripts/start-stack.sh
```

Stop:

```bash
./scripts/stop-stack.sh
```

Or use package scripts:

```bash
pnpm pm2:start
pnpm pm2:restart
pnpm pm2:stop
pnpm pm2:delete
```

Files:

- `ecosystem.config.js`: PM2 process definitions
- `scripts/run-ngrok.sh`: starts ngrok for the configured API port
- `scripts/start-stack.sh`: starts both services and saves PM2 state
- `scripts/stop-stack.sh`: stops and removes both PM2 apps
