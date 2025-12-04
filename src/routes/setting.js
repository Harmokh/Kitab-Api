const { success, error } = require("../utils/response");

module.exports = (models, router) => {
  const SettingsPage = models.SettingsPage;
  const settingRouter = router.Router();

  // Beautiful HTML Template
  const getHtmlTemplate = (title, content) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f4f4f4;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        h1 { color: #1a237e; border-bottom: 2px solid #eee; padding-bottom: 8px; }
        h2 { color: #283593; margin-top: 25px; }
        p, li { font-size: 15px; line-height: 1.7; }
        .footer {
          margin-top: 40px; text-align: center; font-size: 14px; color: #777;
        }
        .footer a { color: #1a73e8; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${title}</h1>
        ${content}
        <div class="footer">
          &copy; ${new Date().getFullYear()} FaydhaaneYusufi (Azhar Academy). All rights reserved.
          <br/><br/>
          App built and designed by 
          <a href="https://brimij.com/" target="_blank">Brimij Technologies Pvt. Ltd.</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Function to fetch & return DB page OR fallback HTML
  const servePage = async (slug, title, defaultContent, res) => {
    try {
      let page = await SettingsPage.findOne({ where: { slug } });

      let html = "";

      if (page) {
        html = page.html;
      } else {
        html = getHtmlTemplate(title, defaultContent);
      }

      return success(res, html, `${title} fetched successfully`);
    } catch (err) {
      return error(res, err.message);
    }
  };

  // ---------------------------
  //  📌 ROUTES
  // ---------------------------

  // Privacy Policy
  settingRouter.get("/setting/privacy", (req, res) => {
    servePage(
      "privacy",
      "Privacy Policy",
      `
                <p>Your privacy is important to us. FaydhaaneYusufi respects your privacy regarding any information we collect.</p>
                <h2>Information We Collect</h2>
                <p>We only ask for personal info when needed to provide services.</p>
                <h2>Data Protection</h2>
                <p>Your data is protected through industry standard methods.</p>
            `,
      res
    );
  });

  // Terms & Conditions
  settingRouter.get("/setting/terms", (req, res) => {
    servePage(
      "terms",
      "Terms & Conditions",
      `
                <p>Welcome to the FaydhaaneYusufi app. By using this app, you agree to these terms.</p>
                <h2>Usage Restrictions</h2>
                <p>You may not modify, resell, or redistribute app content.</p>
            `,
      res
    );
  });

  // About Us
  settingRouter.get("/setting/aboutus", (req, res) => {
    servePage(
      "aboutus",
      "About Us",
      `
                <p>FaydhaaneYusufi brings together the works of Moulana Mohammad Motala (Rahimahullah) under Azhar Academy.</p>
                <h2>Our Mission</h2>
                <p>To preserve and present authentic Islamic knowledge in the digital era.</p>
            `,
      res
    );
  });

  // Contact Us
  settingRouter.get("/setting/contact", (req, res) => {
    servePage(
      "contact",
      "Contact Us",
      `
                <p>If you have questions, feedback, or concerns, please reach out to Azhar Academy.</p>
                <h2>Email</h2>
                <p>support@azharacademy.com</p>
                <h2>Website</h2>
                <p>https://azharacademy.com</p>
            `,
      res
    );
  });

  // FAQs
  settingRouter.get("/setting/faq", (req, res) => {
    servePage(
      "faq",
      "Frequently Asked Questions",
      `
                <h2>1. What is FaydhaaneYusufi?</h2>
                <p>A digital app containing the works of Moulana Mohammad Motala.</p>

                <h2>2. Is the content authentic?</h2>
                <p>Yes. All content is curated and verified by Azhar Academy.</p>
            `,
      res
    );
  });

  return settingRouter;
};
