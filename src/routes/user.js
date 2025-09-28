const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");
const { sequelize } = require("../models/models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

module.exports = (models, router) => {
  const userRouter = router.Router();
  const SALT_ROUNDS = 10;

  // 🔑 Hash Password
  const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
  };

  // ✅ Create or Update User
  userRouter.post("/user/save", async (req, res) => {
    const { id, password, ...userData } = req.body;

    const t = await sequelize.transaction();
    try {
      let userRecord;

      // Check email uniqueness
      const existingUser = await models.User.findOne({
        where: {
          email: userData.email,
          ...(id ? { id: { [Op.ne]: id } } : {}),
        },
        transaction: t,
      });

      if (existingUser) {
        await t.rollback();
        return warning(res, "Email must be unique", MessageType.Warning);
      }

      // Update
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

      // Create
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
        userRecord = await models.User.create(userData, { transaction: t });
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

    // 🔑 User Login
  userRouter.post("/user/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return warning(res, "Email and password are required", MessageType.Warning);
      }

      const userRecord = await models.User.findOne({
        where: { email, isDeleted: false },
        include: [{ model: models.Role, as: "Role" }],
      });

      if (!userRecord) {
        return warning(res, "Invalid email or password", MessageType.Warning);
      }

      const isMatch = await bcrypt.compare(password, userRecord.passwordHash);
      if (!isMatch) {
        return warning(res, "Invalid email or password", MessageType.Warning);
      }

      const token = jwt.sign(
        { id: userRecord.id, roleId: userRecord.roleId, email: userRecord.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return success(res, { token, user: userRecord }, "Login successful");
    } catch (err) {
      return error(res, err.message);
    }
  });


  // 🔍 Get User by ID
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
        // where: whereClause,
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

  return userRouter;
};
