const transporter = require("../config/mail");

async function sendOtpMail(email, otpCode) {
  if (!email) {
    return null;
  }

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your PaisaTrack PK OTP",
    text: `Your PaisaTrack PK OTP is ${otpCode}. It expires in 10 minutes.`,
    html: `<p>Your PaisaTrack PK OTP is <strong>${otpCode}</strong>.</p><p>It expires in 10 minutes.</p>`
  });
}

async function sendBorrowLendInviteMail(email, payload) {
  if (!email) {
    return null;
  }

  const baseUrl = process.env.APP_INVITE_BASE_URL || "exp://192.168.1.8:8081/--";
  const signupUrl = `${baseUrl}/register?email=${encodeURIComponent(email)}`;
  const actionText = payload.type === "borrow" ? "borrowed from you" : "lent you money";
  const amount = Number(payload.amount || 0).toLocaleString("en-PK");

  return transporter.sendMail({
    from: process.env.MAIL_FROM || "PaisaTrack PK <no-reply@paisatrack.local>",
    to: email,
    subject: `${payload.ownerName || "Someone"} added you on PaisaTrack`,
    text: `${payload.ownerName || "Someone"} ${actionText}: PKR ${amount}. Sign up with this email to see the record: ${signupUrl}`,
    html: `
      <p><strong>${payload.ownerName || "Someone"}</strong> ${actionText}: <strong>PKR ${amount}</strong>.</p>
      <p>Sign up with this email to see the record in PaisaTrack.</p>
      <p><a href="${signupUrl}">Open signup</a></p>
    `,
  });
}

async function sendGroupInviteMail(email, payload) {
  if (!email) {
    return null;
  }

  const baseUrl = process.env.APP_INVITE_BASE_URL || "exp://192.168.1.8:8081/--";
  const signupUrl = `${baseUrl}/register?email=${encodeURIComponent(email)}`;
  const owner = payload.ownerName || "Someone";
  const groupName = payload.groupName || "an expense group";

  return transporter.sendMail({
    from: process.env.MAIL_FROM || "PaisaTrack PK <no-reply@paisatrack.local>",
    to: email,
    subject: `${owner} added you to "${groupName}" on PaisaTrack`,
    text: `${owner} added you to the group "${groupName}" to split expenses. Sign up with this email to see and settle your shares: ${signupUrl}`,
    html: `
      <p><strong>${owner}</strong> added you to the group <strong>"${groupName}"</strong> on PaisaTrack to split expenses together.</p>
      <p>Sign up with this email to see your shares and settle up.</p>
      <p><a href="${signupUrl}">Open signup</a></p>
    `,
  });
}

module.exports = {
  sendOtpMail,
  sendBorrowLendInviteMail,
  sendGroupInviteMail
};
