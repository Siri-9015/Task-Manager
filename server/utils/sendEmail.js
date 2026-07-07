const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"Task Manager" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });

  console.log("[Gmail SMTP] ✅ Email sent to:", to, "| Message ID:", info.messageId);
  return info;
};

module.exports = sendEmail;
