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

    // 📄 Get Privacy Policy
    // GET /setting/privacy
    settingRouter.get("/setting/privacy", (req, res) => {
        try {
            const content = `
        <p>Your privacy is important to us. It is Kitab's policy to respect your privacy regarding any information we may collect from you across our website and other sites we own and operate.</p>
        
        <h2>1. Information We Collect</h2>
        <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
        
        <h2>2. How We Use Information</h2>
        <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
        
        <h2>3. Sharing of Information</h2>
        <p>We don’t share any personally identifying information publicly or with third-parties, except when required to by law.</p>
        
        <h2>4. Your Rights</h2>
        <p>You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services.</p>
        
        <p>Your continued use of our website will be regarded as acceptance of our practices around privacy and personal information. If you have any questions about how we handle user data and personal information, feel free to contact us.</p>
      `;
            res.send(getHtmlTemplate("Privacy Policy", content));
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 📄 Get Terms and Conditions
    // GET /setting/terms
    settingRouter.get("/setting/terms", (req, res) => {
        try {
            const content = `
        <p>Welcome to Kitab!</p>
        
        <h2>1. Terms</h2>
        <p>By accessing this website, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
        
        <h2>2. Use License</h2>
        <p>Permission is granted to temporarily download one copy of the materials (information or software) on Kitab's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
        <ul>
          <li>modify or copy the materials;</li>
          <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
          <li>attempt to decompile or reverse engineer any software contained on Kitab's website;</li>
          <li>remove any copyright or other proprietary notations from the materials; or</li>
          <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
        </ul>
        
        <h2>3. Disclaimer</h2>
        <p>The materials on Kitab's website are provided on an 'as is' basis. Kitab makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
        
        <h2>4. Limitations</h2>
        <p>In no event shall Kitab or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Kitab's website, even if Kitab or a Kitab authorized representative has been notified orally or in writing of the possibility of such damage.</p>
        
        <h2>5. Accuracy of Materials</h2>
        <p>The materials appearing on Kitab's website could include technical, typographical, or photographic errors. Kitab does not warrant that any of the materials on its website are accurate, complete or current. Kitab may make changes to the materials contained on its website at any time without notice. However Kitab does not make any commitment to update the materials.</p>
      `;
            res.send(getHtmlTemplate("Terms and Conditions", content));
        } catch (err) {
            return error(res, err.message);
        }
    });

    return settingRouter;
};
