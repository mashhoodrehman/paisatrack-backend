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

module.exports = {
  sendOtpMail
};
