const { success, error } = require("../utils/response");

module.exports = (models, router) => {
  const settingRouter = router.Router();

  const getHtmlTemplate = (title, content) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container {
          background-color: #ffffff;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
        }
        h2 {
          color: #34495e;
          margin-top: 20px;
        }
        p {
          margin-bottom: 15px;
        }
        ul {
          margin-bottom: 15px;
          padding-left: 20px;
        }
        li {
          margin-bottom: 5px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 0.9em;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${title}</h1>
        ${content}
        <div class="footer">
          &copy; ${new Date().getFullYear()} Kitab. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    `;

  // ================================================================
  // 📄 Privacy Policy
  // GET /setting/privacy
  // ================================================================
  settingRouter.get("/setting/privacy", (req, res) => {
    try {
      const content = `
        <p>Your privacy is important to us. It is Kitab's policy to respect your privacy regarding any information we may collect from you across our website and other services.</p>
        <h2>1. Information We Collect</h2>
        <p>We ask for personal information only when necessary and with your consent.</p>
        <h2>2. How We Use Information</h2>
        <p>Your data is used only to provide and improve our services.</p>
        <h2>3. Sharing of Information</h2>
        <p>We never share personal information publicly unless required by law.</p>
        <h2>4. Your Rights</h2>
        <p>You may choose to refuse data requests; however, some features may not work.</p>
      `;
      return success(res, getHtmlTemplate("Privacy Policy", content), "Privacy Policy fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ================================================================
  // 📄 Terms & Conditions
  // GET /setting/terms
  // ================================================================
  settingRouter.get("/setting/terms", (req, res) => {
    try {
      const content = `
        <p>Welcome to Kitab!</p>
        <h2>1. Terms</h2>
        <p>By using our app, you agree to these terms.</p>
        <h2>2. Use License</h2>
        <p>You may not copy, resell or modify our content.</p>
        <h2>3. Disclaimer</h2>
        <p>All content is provided "as is" with no warranties.</p>
        <h2>4. Limitations</h2>
        <p>We are not responsible for any damages that may occur from using our service.</p>
      `;
      return success(res, getHtmlTemplate("Terms & Conditions", content), "Terms & Conditions fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ================================================================
  // 📄 About Us
  // GET /setting/aboutus
  // ================================================================
  settingRouter.get("/setting/aboutus", (req, res) => {
    try {
      const content = `
        <p>Kitab is an innovative platform built to provide users with a clean and efficient reading experience. Our goal is to make accessing books, notes, and annotations seamless and enjoyable.</p>
        <p>We aim to simplify how users manage their reading materials and notifications, ensuring convenience and productivity.</p>
      `;
      return success(res, getHtmlTemplate("About Us", content), "About Us fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ================================================================
  // 📄 Contact Us
  // GET /setting/contact
  // ================================================================
  settingRouter.get("/setting/contact", (req, res) => {
    try {
      const content = `
        <p>If you need help or have any questions, feel free to reach out to us:</p>
        <ul>
            <li><strong>Email:</strong> support@kitab.com</li>
            <li><strong>Phone:</strong> +91 98765 43210</li>
            <li><strong>Website:</strong> www.kitab.com</li>
        </ul>
        <p>We try our best to respond within 24 hours.</p>
      `;
      return success(res, getHtmlTemplate("Contact Us", content), "Contact Us fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ================================================================
  // 📄 FAQ
  // GET /setting/faq
  // ================================================================
  settingRouter.get("/setting/faq", (req, res) => {
    try {
      const content = `
        <h2>1. What is Kitab?</h2>
        <p>Kitab is a reading and notification management platform.</p>

        <h2>2. Is Kitab free?</h2>
        <p>Yes, Kitab is free to use.</p>

        <h2>3. How can I contact support?</h2>
        <p>You can contact us using the information on the Contact Us page.</p>
      `;
      return success(res, getHtmlTemplate("FAQs", content), "FAQ fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  return settingRouter;
};
