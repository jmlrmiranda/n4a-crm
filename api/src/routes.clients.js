const express = require("express");
const prisma = require("./prisma");
const { requireAdmin, requireRole } = require("./middleware.auth");
const { serializeOpp } = require("./finance");

const router = express.Router();

const listSelect = {
  id: true,
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
  status: true,
  saleType: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true,
  estCostPrice: true,
  expectedCloseDate: true,
  createdAt: true,
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

async function nextClientNo() {
  const count = await prisma.client.count();
  return `C${String(count + 1).padStart(4, "0")}`;
}

async function nifExists(nif, excludeId) {
  const existing = await prisma.client.findFirst({
    where: {
      nif,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });

  return Boolean(existing);
}

router.get("/", requireRole("ADMIN", "VENDEDOR"), async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      select: listSelect,
      orderBy: { clientNo: "asc" }
    });

    return res.json(clients);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", requireRole("ADMIN", "VENDEDOR"), async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      select: {
        ...detailSelect,
        opportunities: {
          ...(req.user.role === "VENDEDOR" ? { where: { sellerUserId: req.user.sub } } : {}),
          select: clientOpportunitySelect,
          orderBy: { createdAt: "desc" }
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

router.post("/", requireRole("ADMIN", "VENDEDOR"), async (req, res, next) => {
  try {
    const { name, nif, responsibleName, email, phone, address, description } = req.body || {};

    if (!name || !nif || !responsibleName || !email || !phone) {
      return res.status(400).json({ error: "name, nif, responsibleName, email e phone são obrigatórios" });
    }

    if (await nifExists(nif)) {
      return res.status(409).json({ error: "Conflict" });
    }

    const client = await prisma.client.create({
      data: {
        clientNo: await nextClientNo(),
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

    if (Object.prototype.hasOwnProperty.call(data, "nif") && await nifExists(data.nif, req.params.id)) {
      return res.status(409).json({ error: "Conflict" });
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data,
      select: detailSelect
    });

    return res.json(client);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

module.exports = router;
