const prisma = require("./prisma");

async function requireTenant(req, res, next) {
  try {
    const companyId = req.user && req.user.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true
      }
    });

    if (!company || !company.isActive) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.companyId = company.id;
    req.company = company;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireTenant
};
