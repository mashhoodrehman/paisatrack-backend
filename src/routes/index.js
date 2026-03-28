const express = require("express");

const authRoutes = require("./authRoutes");
const masterDataRoutes = require("./masterDataRoutes");
const userRoutes = require("./userRoutes");
const homeRoutes = require("./homeRoutes");
const expenseRoutes = require("./expenseRoutes");
const groupRoutes = require("./groupRoutes");
const borrowLendRoutes = require("./borrowLendRoutes");
const ledgerRoutes = require("./ledgerRoutes");
const recurringRoutes = require("./recurringRoutes");
const committeeRoutes = require("./committeeRoutes");
const documentRoutes = require("./documentRoutes");
const voiceRoutes = require("./voiceRoutes");
const reportRoutes = require("./reportRoutes");
const cardRoutes = require("./cardRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/master-data", masterDataRoutes);
router.use("/users", userRoutes);
router.use("/home", homeRoutes);
router.use("/expenses", expenseRoutes);
router.use("/groups", groupRoutes);
router.use("/borrow-lend", borrowLendRoutes);
router.use("/ledger", ledgerRoutes);
router.use("/recurring", recurringRoutes);
router.use("/committees", committeeRoutes);
router.use("/documents", documentRoutes);
router.use("/voice", voiceRoutes);
router.use("/reports", reportRoutes);
router.use("/cards", cardRoutes);

module.exports = router;
