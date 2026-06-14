const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "sandbox.smtp.mailtrap.io",
  port: Number(process.env.MAIL_PORT || 2525),
  auth: {
    user: process.env.MAIL_USER || "a030d108e1db2a",
    pass: process.env.MAIL_PASS || "17b9393e91f953"
  }
});

module.exports = transporter;
