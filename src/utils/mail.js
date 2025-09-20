const nodemailer = require("nodemailer");
var path = require("path");
const { error, success } = require("./response");
dotenv = require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});
let transporter = nodemailer.createTransport({
  host: dotenv.parsed.SMTP_SERVER,
  port: dotenv.parsed.SMTP_SERVER_PORT,
  auth: {
    user: dotenv.parsed.FROM_EMAIL,
    pass: dotenv.parsed.SMTP_USER_PASSWORD,
  },
});

sendTemplateMail = async (to, subject, body, res, data, models) => {
  message = {
    from: dotenv.parsed.FROM_EMAIL,
    to: to,
    subject: subject,
    html: body,
  };
  retry(
    () =>
      transporter.sendMail(message, (err, info) => {
        if (err) {
          return error(
            res,
            err.message || "An error occurred while sending the mail"
          );
        } else {
          return success(res, data, "Mail Sent successfully");
        }
      }),
    3
  );
  // transporter.sendMail(message, (err, info) => {
  //   if (err) {
  //     res.boom.badRequest(err);
  //   } else {
  //     res.status(200).send(data);
  //   }
  // });
};

async function retry(fn, n) {
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = {
  sendTemplateMail,
};
