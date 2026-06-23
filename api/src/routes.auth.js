const express = require("express");
const prisma = require("./prisma");
const { checkPassword, signToken } = require("./auth");
const { requireAuth } = require("./middleware.auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email e password são obrigatórios" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true
          }
        }
      }
    });

    if (!user || !user.isActive || !user.company || !user.company.isActive) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const passwordOk = await checkPassword(password, user.passwordHash);

    if (!passwordOk) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = signToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      companyId: user.companyId
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        isActive: user.company.isActive
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/switch-company", requireAuth, async (req, res, next) => {
  try {
    const { targetCompanyId } = req.body || {};

    if (!["N4A_SUPPORT", "N4A_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!targetCompanyId) {
      return res.status(400).json({ error: "targetCompanyId é obrigatório" });
    }

    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
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

    const token = signToken({
      sub: req.user.sub,
      role: req.user.role,
      name: req.user.name,
      companyId: company.id
    });

    return res.status(200).json({
      token,
      company
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
