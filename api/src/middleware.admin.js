function requireN4AAdmin(req, res, next) {
  if (!req.user || req.user.role !== "N4A_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

function requireN4ASupportOrAdmin(req, res, next) {
  if (!req.user || !["N4A_ADMIN", "N4A_SUPPORT"].includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

module.exports = {
  requireN4AAdmin,
  requireN4ASupportOrAdmin
};
