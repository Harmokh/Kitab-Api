const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");
const { sequelize } = require("../models/models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const { sendTemplateMail } = require("../utils/mail");
const {
  getActivationEmailTemplate,
  getForgetPasswordEmailTemplate,
  getAccountStatusEmailTemplate,
} = require("../utils/emailTemplates");
const client = new OAuth2Client(
  "1061077670326-7ng30cuvgbdbu1c7cbdmqrv4fslp8gpb.apps.googleusercontent.com"
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./public/profile_images";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

module.exports = (models, router) => {
  const userRouter = router.Router();
  const SALT_ROUNDS = 10;

  /**
   * @swagger
   * components:
   *   schemas:
   *     User:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the user
   *         name:
   *           type: string
   *           description: The name of the user
   *         email:
   *           type: string
   *           description: The email of the user
   *         roleId:
   *           type: integer
   *           description: The role id of the user
   *         isActive:
   *           type: boolean
   *           description: Whether the user is active
   *         isVerified:
   *           type: boolean
   *           description: Whether the user is verified
   *         image:
   *           type: string
   *           description: Profile image path
   */

  // 🔑 Hash Password
  const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
  };

  /**
   * @swagger
   * /user/save:
   *   post:
   *     summary: Create or update a user
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/User'
   *     responses:
   *       200:
   *         description: The user was successfully saved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       500:
   *         description: Some server error
   */
  userRouter.post("/user/save", async (req, res) => {
    const { id, password, ...userData } = req.body;

    const t = await sequelize.transaction();
    try {
      let userRecord;

      // 🔍 Check email uniqueness
      const existingUser = await models.User.findOne({
        where: {
          email: userData.email,
          ...(id ? { id: { [Op.ne]: id } } : {}),
        },
        transaction: t,
      });

      if (existingUser) {
        // ⭐ If email exists but user is NOT verified → resend activation
        if (!existingUser.isVerified) {
          const token = generateActivationToken(existingUser.id);
          const activationLink = `${process.env.WEB_URL}/activate/${token}`;
          const logoLink = `${process.env.STATIC_FILE_URL}logo/Logo_Kitab_App.jpg`;
          const html = getActivationEmailTemplate(
            existingUser.name,
            activationLink,
            logoLink
          );

          await sendTemplateMail(
            existingUser.email,
            "Activate Your Account",
            html,
            null,
            null
          );

          await t.commit();
          return success(
            res,
            null,
            "User is not verified. Activation link has been resent."
          );
        }

        // ❌ If verified user exists → block
        await t.rollback();
        return warning(res, "Email already exists", MessageType.Warning);
      }

      // ✏️ Update user
      if (id) {
        userRecord = await models.User.findOne({
          where: { id },
          transaction: t,
        });

        if (userRecord) {
          if (password) {
            userData.passwordHash = await hashPassword(password);
          }
          await userRecord.update(userData, { transaction: t });
        }
      }

      // ➕ Create user
      if (!userRecord) {
        if (!password) {
          await t.rollback();
          return warning(
            res,
            "Password is required for new users",
            MessageType.Warning
          );
        }

        userData.passwordHash = await hashPassword(password);
        userData.isActive = false; // 👈 mark inactive until activation
        userRecord = await models.User.create(userData, { transaction: t });

        // 📧 Send activation email
        const token = generateActivationToken(userRecord.id);

        const activationLink = `${process.env.WEB_URL}/activate/${token}`;
        const logoLink = `${process.env.STATIC_FILE_URL}logo/Logo_Kitab_App.jpg`;
        const html = getActivationEmailTemplate(
          userRecord.name,
          activationLink,
          logoLink
        );

        await sendTemplateMail(
          userRecord.email,
          "Activate Your Account",
          html,
          null,
          null
        );
      }

      await t.commit();

      const savedUser = await models.User.findByPk(userRecord.id, {
        include: [{ model: models.Role, as: "Role" }],
      });

      return success(
        res,
        savedUser,
        id ? "User updated successfully" : "User created successfully"
      );
    } catch (err) {
      await t.rollback();
      return error(
        res,
        err.message || "An error occurred while saving the user."
      );
    }
  });

  // 🔐 USER LOGIN
  /**
   * @swagger
   * /user/login:
   *   post:
   *     summary: Login a user
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized
   */
  userRouter.post("/user/login", async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { email, password } = req.body;

      // 1️⃣ Validate input
      if (!email || !password) {
        await transaction.rollback();
        return warning(
          res,
          "Email and password are required",
          MessageType.Warning
        );
      }

      // 2️⃣ Find user
      const user = await models.User.findOne({
        where: { email, isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
        transaction,
      });

      // If user not found
      if (!user) {
        await transaction.rollback();
        return warning(res, "Invalid email or password", MessageType.Warning);
      }

      // 3️⃣ Check user status
      if (!user.isVerified) {
        await transaction.rollback();
        return warning(
          res,
          "Your account is not verified. Please check your email to activate your account.",
          MessageType.Warning
        );
      }

      if (!user.isActive) {
        await transaction.rollback();
        return warning(
          res,
          "Your account is deactivated. Please contact the administrator.",
          MessageType.Warning
        );
      }

      // 4️⃣ Compare password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        await transaction.rollback();
        return warning(res, "Invalid email or password", MessageType.Warning);
      }

      // 5️⃣ Create JWT
      const token = jwt.sign(
        {
          id: user.id,
          roleId: user.roleId,
          email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // 6️⃣ Create user session
      await models.UserSession.create(
        {
          userId: user.id,
          loginTime: new Date(),
          ipAddress: req.headers["x-forwarded-for"] || req.ip || null,
          userAgent: req.headers["user-agent"] || null,
          isActive: true,
        },
        { transaction }
      );

      await transaction.commit();

      return success(res, { token, user }, "Login successful");
    } catch (err) {
      await transaction.rollback();
      console.error("🔥 Login Error:", err);

      return error(
        res,
        err.message ||
        "An unexpected error occurred during login. Please try again."
      );
    }
  });

  userRouter.get("/user/activate/:token", async (req, res) => {
    try {
      const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

      const user = await models.User.findOne({ where: { id: decoded.id } });

      if (!user) return error(res, "Invalid activation link");

      if (user.isActive && user.isVerified)
        return success(res, {}, "Account already activated");

      await user.update({ isActive: true, isVerified: true });

      return success(res, {}, "Account activated successfully");
    } catch (err) {
      return error(res, "Invalid or expired activation link");
    }
  });

  // ⭐ FORGET PASSWORD - Send Reset Link
  userRouter.post("/user/forgotpassword", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return warning(res, "Email is required", MessageType.Warning);
      }

      const user = await models.User.findOne({
        where: { email, isDeleted: false },
      });

      if (!user) {
        return warning(
          res,
          "No account found with this email",
          MessageType.Warning
        );
      }

      // 3️⃣ Check user status
      if (!user.isVerified) {
        return warning(
          res,
          "Your account is not verified.",
          MessageType.Warning
        );
      }

      if (!user.isActive) {
        return warning(
          res,
          "Your account is deactivated. Please contact the administrator.",
          MessageType.Warning
        );
      }

      // Generate JWT reset token
      const token = generateActivationToken(user.id);
      const resetLink = `${process.env.WEB_URL}/reset-password/${token}`;

      // Prepare email template
      const logoLink = `${process.env.STATIC_FILE_URL}logo/Logo_Kitab_App.jpg`;
      const html = getForgetPasswordEmailTemplate(
        user.name,
        resetLink,
        logoLink
      );

      // Send email
      await sendTemplateMail(
        user.email,
        "Reset Your Password",
        html,
        null,
        null
      );

      return success(res, {}, "Password reset link sent to your email");
    } catch (err) {
      return error(res, err.message || "Unable to process request");
    }
  });

  // Change Status of user
  userRouter.post("/user/changestatus", async (req, res) => {
    try {
      const { id, newStatus } = req.body;

      if (!id) {
        return warning(res, "User ID is required", MessageType.Warning);
      }

      const user = await models.User.findOne({
        where: { id, isDeleted: false },
      });

      if (!user) {
        return warning(
          res,
          "No account found with this user ID",
          MessageType.Warning
        );
      }

      await user.update({ isActive: newStatus });

      const statusText = newStatus ? "Activated" : "Deactivated";
      const logoLink = `${process.env.STATIC_FILE_URL}logo/Logo_Kitab_App.jpg`;
      const html = getAccountStatusEmailTemplate(
        user.name,
        newStatus,
        logoLink,
        `${process.env.WEB_URL}/login`
      );

      await sendTemplateMail(
        user.email,
        "Your account has been " + statusText,
        html,
        null,
        null
      );

      return success(res, {}, "Account status updated successfully");
    } catch (err) {
      return error(res, err.message || "Unable to process request");
    }
  });

  // ⭐ RESET PASSWORD - Using Token
  userRouter.post("/user/resetpassword/verify", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return warning(
          res,
          "Token and new password are required",
          MessageType.Warning
        );
      }

      // Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return error(res, "Invalid or expired reset link");
      }

      const user = await models.User.findOne({
        where: { id: decoded.id, isDeleted: false },
      });

      if (!user) {
        return error(res, "User not found");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await user.update({ passwordHash: hashedPassword });

      return success(res, {}, "Password has been reset successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // Google Auth (Login/Signup)
  userRouter.post("/user/google-auth", async (req, res) => {
    const t = await sequelize.transaction();
    try {
      console.log(
        "Google Auth Request Body:",
        JSON.stringify(req.body, null, 2)
      );
      const idToken = req.body.idToken || req.body?.data?.idToken;

      if (!idToken) {
        await t.rollback();
        return warning(res, "Google ID token is required", MessageType.Warning);
      }

      // Verify Google Token
      const ticket = await client.verifyIdToken({
        idToken,
        audience:
          "1061077670326-7ng30cuvgbdbu1c7cbdmqrv4fslp8gpb.apps.googleusercontent.com",
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      if (!email) {
        await t.rollback();
        return warning(
          res,
          "Email not found in Google token",
          MessageType.Warning
        );
      }

      // Check if user exists
      let userRecord = await models.User.findOne({
        where: { email },
        include: [{ model: models.Role, as: "Role" }],
        transaction: t,
      });

      if (userRecord) {
        // Update Google ID if missing
        if (!userRecord.googleId) {
          await userRecord.update({ googleId }, { transaction: t });
        }
      } else {
        // Create new user
        // Generate random password hash since it's required
        const randomPassword =
          Math.random().toString(36).slice(-8) +
          Math.random().toString(36).slice(-8);
        const passwordHash = await hashPassword(randomPassword);

        // Get default role (assuming 'User' role exists with ID 2 or similar, but safer to query)
        // For now, let's assume roleId 2 is User, or query for it.
        // Better to query for 'User' role.
        const userRole = await models.Role.findOne({
          where: { name: "User" },
          transaction: t,
        });
        const roleId = userRole ? userRole.id : 2; // Default to 2 if not found, or handle error

        userRecord = await models.User.create(
          {
            name,
            email,
            image: picture,
            googleId,
            passwordHash,
            roleId,
            isVerified: true, // Google verified
          },
          { transaction: t }
        );

        // Fetch again to include Role
        userRecord = await models.User.findByPk(userRecord.id, {
          include: [{ model: models.Role, as: "Role" }],
          transaction: t,
        });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: userRecord.id,
          roleId: userRecord.roleId,
          email: userRecord.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Record Session
      await models.UserSession.create(
        {
          userId: userRecord.id,
          loginTime: new Date(),
          ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
          userAgent: req.headers["user-agent"] || null,
          isActive: true,
        },
        { transaction: t }
      );

      await t.commit();
      return success(
        res,
        { token, user: userRecord },
        "Google authentication successful"
      );
    } catch (err) {
      await t.rollback();
      console.error("Google Auth error:", err);
      return error(res, err.message || "Google authentication failed");
    }
  });

  // 🔍 Get User by ID
  /**
   * @swagger
   * /user/getbyid:
   *   get:
   *     summary: Get a user by ID
   *     tags: [Users]
   *     parameters:
   *       - in: query
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The user ID
   *     responses:
   *       200:
   *         description: The user description by id
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       404:
   *         description: The user was not found
   */
  userRouter.get("/user/getbyid", authenticate, async (req, res) => {
    try {
      const userRecord = await models.User.findOne({
        where: { id: req.query.id, isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
      });

      if (!userRecord) {
        return warning(res, "User not found", MessageType.Warning);
      }

      return success(res, userRecord, "User fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 Get All Users with Pagination & Filters
  /**
   * @swagger
   * /user/getall:
   *   get:
   *     summary: Get all users
   *     tags: [Users]
   *     parameters:
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *         description: Number of users per page
   *       - in: query
   *         name: currentPage
   *         schema:
   *           type: integer
   *         description: Current page number
   *     responses:
   *       200:
   *         description: List of users
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: integer
   *                 rows:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   */
  userRouter.get("/user/getall", authenticate, async (req, res) => {
    try {
      const { pageSize = 10, currentPage = 1, ...filters } = req.query;
      // const whereClause = { isDeleted: false };

      // for (const key in filters) {
      //   if (filters[key]) {
      //     whereClause[key] = { [Op.iLike]: `%${filters[key]}%` };
      //   }
      // }

      const result = await models.User.findAndCountAll({
        where: { isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Users fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 Get Master List (All Users without pagination)
  userRouter.get("/user/getmaster", authenticate, async (req, res) => {
    try {
      const users = await models.User.findAll({
        where: { isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, users, "Users fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🗑️ Soft Delete User
  userRouter.delete("/user/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      const [updated] = await models.User.update(
        { isDeleted: true, isActive: false },
        { where: { id } }
      );

      if (updated) {
        return success(res, null, "User deleted successfully");
      } else {
        return warning(res, "User not found", MessageType.Warning);
      }
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🔄 Change User Role
  userRouter.post("/user/changerole", authenticate, async (req, res) => {
    try {
      const { id, roleId } = req.body;
      const userRecord = await models.User.findOne({ where: { id } });
      if (!userRecord) {
        return warning(res, "User not found", MessageType.Warning);
      }

      await userRecord.update({ roleId });
      return success(res, userRecord, "User role updated successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🔑 Reset Password
  userRouter.post("/user/resetpassword", authenticate, async (req, res) => {
    try {
      const { id, newPassword } = req.body;
      if (!newPassword) {
        return warning(res, "New password is required", MessageType.Warning);
      }

      const userRecord = await models.User.findOne({ where: { id } });
      if (!userRecord) {
        return warning(res, "User not found", MessageType.Warning);
      }

      const hashedPassword = await hashPassword(newPassword);
      await userRecord.update({ passwordHash: hashedPassword });

      return success(res, null, "Password updated successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 List Users by Role
  userRouter.get("/user/byrole", authenticate, async (req, res) => {
    try {
      const { roleId } = req.query;
      if (!roleId) {
        return warning(res, "RoleId is required", MessageType.Warning);
      }

      const users = await models.User.findAll({
        where: { roleId, isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, users, "Users fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🖼️ Upload Profile Image

  userRouter.post(
    "/user/upload-image",
    authenticate,
    upload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return warning(res, "No image file provided", MessageType.Warning);
        }

        const userId = req.user.id;
        const userRecord = await models.User.findOne({ where: { id: userId } });

        if (!userRecord) {
          // Clean up uploaded file if user not found
          fs.unlinkSync(req.file.path);
          return warning(res, "User not found", MessageType.Warning);
        }

        // Delete old image if exists and is local
        if (
          userRecord.image &&
          userRecord.image.startsWith("/profile_images/")
        ) {
          const oldPath = path.join("./public", userRecord.image);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }

        const imagePath = "/profile_images/" + req.file.filename;
        await userRecord.update({ image: imagePath });

        // Return full URL if needed, or just the relative path
        // Assuming client constructs URL or we use a helper
        // For consistency with other parts, we might want to return full URL if env var is set
        // But the model stores the relative path usually or full path?
        // Looking at document.js, it seems to store relative path often but returns full URL.
        // Let's return the updated user object.

        return success(
          res,
          { ...userRecord.toJSON(), image: imagePath },
          "Profile image updated successfully"
        );
      } catch (err) {
        console.error("Upload error:", err);
        return error(res, err.message);
      }
    }
  );

  return userRouter;
};

const generateActivationToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "2d" } // activation valid for 48h
  );
};
