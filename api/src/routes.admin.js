const express = require("express");
const prisma = require("./prisma");
const { hashPassword } = require("./auth");
const { requireN4AAdmin } = require("./middleware.admin");

const router = express.Router();

const companySelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  createdAt: true
};

const userSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true
};

function handlePrismaError(err, res, next) {
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Conflict" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Not found" });
  }

  return next(err);
}

router.get("/companies", async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true
      },
      orderBy: { name: "asc" }
    });

    return res.json(companies);
  } catch (err) {
    return next(err);
  }
});

router.post("/companies", requireN4AAdmin, async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword } = req.body || {};

    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        error: "name, slug, adminName, adminEmail e adminPassword são obrigatórios"
      });
    }

    const passwordHash = await hashPassword(adminPassword);
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name, slug },
        select: companySelect
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
          isActive: true
        },
        select: userSelect
      });

      return { company, user };
    });

    return res.status(201).json(result);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.post("/companies/:id/support-user", requireN4AAdmin, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email e password são obrigatórios" });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { id: true }
    });

    if (!company) {
      return res.status(404).json({ error: "Not found" });
    }

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "N4A_SUPPORT",
        isActive: true
      },
      select: userSelect
    });

    return res.status(201).json(user);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
