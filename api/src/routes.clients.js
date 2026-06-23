const express = require("express");
const prisma = require("./prisma");
const { requireAdmin, requireRole } = require("./middleware.auth");
const { serializeOpp } = require("./finance");

const router = express.Router();

const listSelect = {
  id: true,
  companyId: true,
  clientNo: true,
  name: true,
  nif: true,
  responsibleName: true,
  email: true,
  phone: true,
  createdAt: true
};

const detailSelect = {
  ...listSelect,
  address: true,
  description: true
};

const clientOpportunitySelect = {
  id: true,
  oppNo: true,
  title: true,
  status: true,
  saleType: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true,
  estCostPrice: true,
  finalServices: true,
  finalSoftware: true,
  finalHardware: true,
  finalMaintenance: true,
  expectedCloseDate: true,
  createdAt: true,
  updatedAt: true,
  seller: {
    select: {
      id: true,
      name: true
    }
  }
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

async function nextClientNo(companyId) {
  const count = await prisma.client.count({ where: { companyId } });
  return `C${String(count + 1).padStart(4, "0")}`;
}

async function nifExists(companyId, nif, excludeId) {
  const existing = await prisma.client.findFirst({
    where: {
      companyId,
      nif,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });

  return Boolean(existing);
}

router.get("/", requireRole("ADMIN", "VENDEDOR", "N4A_SUPPORT"), async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      where: { companyId: req.companyId },
      select: listSelect,
      orderBy: { clientNo: "asc" }
    });

    return res.json(clients);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", requireRole("ADMIN", "VENDEDOR", "N4A_SUPPORT"), async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId
      },
      select: {
        ...detailSelect,
        opportunities: {
          where: {
            companyId: req.companyId,
            ...(req.user.role === "VENDEDOR" ? { sellerUserId: req.user.sub } : {})
          },
          select: clientOpportunitySelect,
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({
      ...client,
      opportunities: client.opportunities.map(serializeOpp)
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/", requireRole("ADMIN", "VENDEDOR", "N4A_SUPPORT"), async (req, res, next) => {
  try {
    const { name, nif, responsibleName, email, phone, address, description } = req.body || {};

    if (!name || !nif || !responsibleName || !email || !phone) {
      return res.status(400).json({ error: "name, nif, responsibleName, email e phone são obrigatórios" });
    }

    if (await nifExists(req.companyId, nif)) {
      return res.status(409).json({ error: "Conflict" });
    }

    const client = await prisma.client.create({
      data: {
        companyId: req.companyId,
        clientNo: await nextClientNo(req.companyId),
        name,
        nif,
        responsibleName,
        email,
        phone,
        address,
        description
      },
      select: detailSelect
    });

    return res.status(201).json(client);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const data = {};
    const body = req.body || {};
    const allowedFields = ["name", "nif", "responsibleName", "email", "phone", "address", "description"];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, "nif") && await nifExists(req.companyId, data.nif, req.params.id)) {
      return res.status(409).json({ error: "Conflict" });
    }

    const result = await prisma.client.updateMany({
      where: {
        id: req.params.id,
        companyId: req.companyId
      },
      data
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId
      },
      select: detailSelect
    });

    return res.json(client);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
