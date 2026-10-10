// requireAdmin.js
// Use after `authenticate`: lets the request through only for an active admin.
var models = require("../models/models.js");

// Same rule the admin panel's route guard uses.
// The role is read from the database because the one inside the token can be stale.
const isAdmin = async (userId) => {
  if (!userId) return false;

  const user = await models.User.findOne({
    where: { id: userId, isDeleted: false, isActive: true },
    include: [{ model: models.Role, as: "Role" }],
  });

  return !!user && (user.Role?.name === "Admin" || user.roleId === 1);
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!(await isAdmin(req.user?.id))) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = requireAdmin;
module.exports.isAdmin = isAdmin;
