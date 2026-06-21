// optionalAuth.js
// Like `authenticate`, but does not reject unauthenticated requests.
// If a valid token is present, attaches req.user; otherwise continues as a guest.
const jwt = require("jsonwebtoken");

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return next(); // Guest: continue without a user

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload) req.user = payload; // 👈 Attach user when token is valid
  } catch (err) {
    // Invalid/expired token: treat as guest rather than blocking browsing
  }

  next();
};

module.exports = optionalAuth;
