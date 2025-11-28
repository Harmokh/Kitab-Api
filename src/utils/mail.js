const nodemailer = require("nodemailer");
const path = require("path");
const { error, success } = require("./response");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

// Create transporter once
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER,
  port: Number(process.env.SMTP_SERVER_PORT),
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.SMTP_USER_PASSWORD,
  },
});

/**
 * Retry helper
 */
async function retry(fn, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error("Retry error:", err);
    }
  }
}

/**
 * Send template mail
 */
const sendTemplateMail = async (to, subject, body, res, data) => {
  const message = {
    from: process.env.FROM_EMAIL,
    to,
    subject,
    html: body,
  };

  await retry(
    () =>
      transporter.sendMail(message, (err) => {
        if (err) {
          return error(
            res,
            err.message || "An error occurred while sending the mail"
          );
        }
        return success(res, data, "Mail sent successfully");
      }),
    3
  );
};

module.exports = { sendTemplateMail };
