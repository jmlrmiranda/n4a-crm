const express = require("express");
const prisma = require("./prisma");
const { hashPassword } = require("./auth");

const router = express.Router();
const roles = ["ADMIN", "VENDEDOR"];

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

router.get("/", async (req, res, next) => {
  try {
    if (!req.user.companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId },
      select: userSelect,
      orderBy: { createdAt: "asc" }
    });

    return res.json(users);
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!req.user.companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password e role são obrigatórios" });
    }

    if (!roles.includes(role)) {
      return res.status(400).json({ error: "role inválida" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        companyId: req.user.companyId,
        name,
        email,
        passwordHash,
        role
      },
      select: userSelect
    });

    return res.status(201).json(user);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = {};
    const body = req.body || {};

    if (!req.user.companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      data.name = body.name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "role")) {
      if (!roles.includes(body.role)) {
        return res.status(400).json({ error: "role inválida" });
      }

      data.role = body.role;
    }

    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return res.status(400).json({ error: "isActive deve ser boolean" });
      }

      data.isActive = body.isActive;
    }

    const result = await prisma.user.updateMany({
      where: {
        id: req.params.id,
        companyId: req.user.companyId
      },
      data
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user.companyId
      },
      select: userSelect
    });

    return res.json(user);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

// PATCH /api/users/:id/password
// Utilizador só pode alterar a sua própria password
// ADMIN pode alterar password de qualquer utilizador da mesma empresa
router.patch("/:id/password", async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const requesterId = req.user.id;
    const targetId = req.params.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!req.user.companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "password deve ter pelo menos 8 caracteres" });
    }

    // Só pode alterar a própria password, ou ADMIN pode alterar de utilizadores da mesma empresa
    if (targetId !== requesterId && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Confirma que o utilizador alvo pertence à mesma empresa
    const target = await prisma.user.findFirst({
      where: { id: targetId, companyId: req.user.companyId },
      select: { id: true }
    });

    if (!target) {
      return res.status(404).json({ error: "Not found" });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: targetId },
      data: { passwordHash }
    });

    return res.status(200).json({ message: "Password actualizada" });
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
