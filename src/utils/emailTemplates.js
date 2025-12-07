const getActivationEmailTemplate = (name, activationLink, logolink) => {
  return `
  <div style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f4f4; padding: 0; margin: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      
      <!-- Header -->
      <tr>
        <td style="background: linear-gradient(135deg, #0a3d2e, #0f5132); padding: 30px; text-align: center; color: #fff;">
          <img src="${logolink}" alt="Faydhaane Yousufi" width="80" style="margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px;">Faydhaane Yousufi</h1>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Read • Learn • Reflect</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background: #fff; padding: 30px;">
          
          <!-- Greeting -->
          <h2 style="color: #0f5132; margin-top: 0;">
            Assalamu Alaikum ${name},
          </h2>

          <p style="font-size: 15px; color: #333; line-height: 1.6;">
            <strong>Welcome to Faydhaane Yousufi – Your Islamic Knowledge Companion.</strong><br><br>
            Thank you for registering! Please verify your email to activate your account and start your journey of reading and managing Islamic books.
          </p>

          <!-- Divider -->
          <div style="border-top: 2px solid #e2e3e5; margin: 25px 0;"></div>

          <!-- Activation Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${activationLink}"
              style="
                background: #0f5132;
                color: #fff;
                padding: 14px 26px;
                font-size: 16px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                display: inline-block;
                letter-spacing: 1px;
              ">
              Activate My Account
            </a>
          </div>

          <!-- Quote box -->
          <div style="background:#faf7e8; border-left:4px solid #c9a227; padding:15px; margin-top: 30px; border-radius: 6px;">
            <p style="margin:0; font-size:14px; font-style:italic; color:#6c552c;">
              “Whoever treads a path in search of knowledge, Allah will make easy for him the path to Paradise.”
            </p>
            <p style="text-align:right; margin:5px 0 0; font-size:13px; color:#8a6d3b;">
              — Sahih Muslim
            </p>
          </div>

          <!-- Footer message -->
          <p style="font-size: 13px; color: #666; margin-top: 30px; line-height: 1.6;">
            This link is valid for 24 hours. If you did not register for this account, please ignore this email.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background: #0a3d2e; padding: 15px; text-align: center; color: #fff; font-size: 12px;">
          © ${new Date().getFullYear()} Faydhaane Yousufi All Rights Reserved.
        </td>
      </tr>

    </table>
  </div>
  `;
};
const getForgetPasswordEmailTemplate = (name, resetLink, logoLink) => {
  return `
  <div style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f4f4; padding: 0; margin: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      
      <!-- Header -->
      <tr>
        <td style="background: linear-gradient(135deg, #0a3d2e, #0f5132); padding: 30px; text-align: center; color: #fff;">
          <img src="${logoLink}" alt="Faydhaane Yousufi" width="80" style="margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px;">Faydhaane Yousufi</h1>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Read • Learn • Reflect</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background: #fff; padding: 30px;">
          
          <!-- Greeting -->
          <h2 style="color: #0f5132; margin-top: 0;">
            Assalamu Alaikum ${name},
          </h2>

          <p style="font-size: 15px; color: #333; line-height: 1.6;">
            You requested to reset your password for your <strong>Faydhaane Yousufi</strong> account.
            Please click the button below to set a new password.
          </p>

          <!-- Divider -->
          <div style="border-top: 2px solid #e2e3e5; margin: 25px 0;"></div>

          <!-- Reset Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetLink}"
              style="
                background: #0f5132;
                color: #fff;
                padding: 14px 26px;
                font-size: 16px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                display: inline-block;
                letter-spacing: 1px;
              ">
              Reset My Password
            </a>
          </div>

          <!-- Quote box -->
          <div style="background:#faf7e8; border-left:4px solid #c9a227; padding:15px; margin-top: 30px; border-radius: 6px;">
            <p style="margin:0; font-size:14px; font-style:italic; color:#6c552c;">
              “Indeed, with hardship comes ease.”
            </p>
            <p style="text-align:right; margin:5px 0 0; font-size:13px; color:#8a6d3b;">
              — Surah Ash-Sharh (94:6)
            </p>
          </div>

          <!-- Footer message -->
          <p style="font-size: 13px; color: #666; margin-top: 30px; line-height: 1.6;">
            This reset link is valid for only 15 minutes.<br>
            If you did not request this, please ignore this email — your account is safe.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background: #0a3d2e; padding: 15px; text-align: center; color: #fff; font-size: 12px;">
          © ${new Date().getFullYear()} Faydhaane Yousufi — All Rights Reserved.
        </td>
      </tr>

    </table>
  </div>
  `;
};

module.exports = { getActivationEmailTemplate, getForgetPasswordEmailTemplate };
