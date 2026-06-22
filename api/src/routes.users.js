const express = require("express");
const prisma = require("./prisma");
const { hashPassword } = require("./auth");

const router = express.Router();
const roles = ["ADMIN", "VENDEDOR"];

const userSelect = {
  id: true,
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
    const users = await prisma.user.findMany({
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

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password e role são obrigatórios" });
    }

    if (!roles.includes(role)) {
      return res.status(400).json({ error: "role inválida" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
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

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect
    });

    return res.json(user);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
