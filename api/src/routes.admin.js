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

// PATCH /admin/companies/:id
// Permite alterar name, slug, isActive
// Requer N4A_ADMIN
router.patch("/companies/:id", requireN4AAdmin, async (req, res, next) => {
  try {
    const data = {};
    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      data.name = body.name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      data.slug = body.slug;
    }

    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return res.status(400).json({ error: "isActive deve ser boolean" });
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nenhum campo para actualizar" });
    }

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data,
      select: companySelect
    });

    return res.json(company);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

// DELETE /admin/companies/:id
// Desactiva empresa (soft delete: isActive = false)
// Não apaga dados — apenas impede login dos utilizadores dessa empresa
// Requer N4A_ADMIN
router.delete("/companies/:id", requireN4AAdmin, async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true }
    });

    if (!company) {
      return res.status(404).json({ error: "Not found" });
    }

    await prisma.$transaction([
      prisma.company.update({
        where: { id: req.params.id },
        data: { isActive: false }
      }),
      prisma.user.updateMany({
        where: { companyId: req.params.id },
        data: { isActive: false }
      })
    ]);

    return res.status(200).json({ message: `Empresa ${company.name} desactivada` });
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
