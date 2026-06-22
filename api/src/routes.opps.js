const express = require("express");
const multer = require("multer");
const prisma = require("./prisma");
const { requireAdmin } = require("./middleware.auth");
const { serializeOpp } = require("./finance");
const { transitionStatus } = require("./transitions");

const UPLOAD_DIR = process.env.UPLOAD_DIR;

if (!UPLOAD_DIR) {
  throw new Error("UPLOAD_DIR não definido — abortando");
}

const router = express.Router();
const saleTypes = ["PROJETO", "SUBSCRICAO"];
const statuses = [
  "ABERTA",
  "PROPOSTA_EM_PREPARACAO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHA",
  "PERDIDA"
];
const attachmentTypes = ["PROPOSTA", "COMPRA", "FATURA"];

const oppListSelect = {
  id: true,
  oppNo: true,
  clientId: true,
  sellerUserId: true,
  saleType: true,
  status: true,
  archived: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true,
  estCostPrice: true,
  expectedCloseDate: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      clientNo: true,
      name: true
    }
  },
  seller: {
    select: {
      id: true,
      name: true
    }
  }
};

const oppDetailSelect = {
  ...oppListSelect,
  finalServices: true,
  finalSoftware: true,
  finalHardware: true,
  finalMaintenance: true,
  realCostPrice: true,
  lossReason: true,
  billingStartDate: true,
  proposalSentDate: true,
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      changedBy: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  },
  attachments: {
    select: {
      id: true,
      type: true,
      filename: true,
      adjudicada: true,
      uploadedAt: true
    },
    orderBy: { uploadedAt: "asc" }
  },
  contacts: {
    select: {
      id: true,
      date: true,
      channel: true,
      note: true
    },
    orderBy: { date: "asc" }
  }
};

const contactSelect = {
  id: true,
  date: true,
  channel: true,
  note: true
};

const attachmentSelect = {
  id: true,
  type: true,
  filename: true,
  adjudicada: true,
  uploadedAt: true
};

const upload = multer({
  dest: UPLOAD_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      return cb(null, true);
    }

    const err = new Error("ficheiro deve ser PDF");
    err.status = 400;
    return cb(err);
  }
});

function handlePrismaError(err, res, next) {
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Conflict" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Not found" });
  }

  return next(err);
}

function isVendor(user) {
  return user && user.role === "VENDEDOR";
}

function visibleOppWhere(id, user) {
  const where = { id };

  if (isVendor(user)) {
    where.sellerUserId = user.sub;
  }

  return where;
}

async function findVisibleOpp(id, user, select) {
  return prisma.opportunity.findFirst({
    where: visibleOppWhere(id, user),
    select
  });
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("invalid_boolean");
}

function parseDateValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_date");
  }

  return date;
}

function parseDecimalValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    throw new Error("invalid_decimal");
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("invalid_decimal");
  }

  return number;
}

function assignIfPresent(data, body, field, parser) {
  if (Object.prototype.hasOwnProperty.call(body, field)) {
    data[field] = parser(body[field]);
  }
}

async function nextOppNo() {
  const count = await prisma.opportunity.count();
  return `O${String(count + 1).padStart(5, "0")}`;
}

function uploadFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    return next();
  });
}

router.get("/", async (req, res, next) => {
  try {
    const where = {};
    const { status, archived, sellerId, clientId } = req.query;

    if (status) {
      if (!statuses.includes(status)) {
        return res.status(400).json({ error: "status inválido" });
      }

      where.status = status;
    }

    if (archived !== undefined) {
      try {
        where.archived = parseBoolean(archived);
      } catch (err) {
        return res.status(400).json({ error: "archived deve ser true ou false" });
      }
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (isVendor(req.user)) {
      where.sellerUserId = req.user.sub;
    } else if (sellerId) {
      where.sellerUserId = sellerId;
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      select: oppListSelect,
      orderBy: { updatedAt: "desc" }
    });

    return res.json(opportunities.map(serializeOpp));
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const { clientId, saleType } = body;

    if (!clientId || !saleType) {
      return res.status(400).json({ error: "clientId e saleType são obrigatórios" });
    }

    if (!saleTypes.includes(saleType)) {
      return res.status(400).json({ error: "saleType inválido" });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true }
    });

    if (!client) {
      return res.status(404).json({ error: "Not found" });
    }

    const data = {
      oppNo: await nextOppNo(),
      clientId,
      sellerUserId: req.user.role === "ADMIN" && body.sellerUserId ? body.sellerUserId : req.user.sub,
      saleType,
      status: "ABERTA"
    };

    assignIfPresent(data, body, "expectedCloseDate", parseDateValue);
    assignIfPresent(data, body, "estServices", parseDecimalValue);
    assignIfPresent(data, body, "estSoftware", parseDecimalValue);
    assignIfPresent(data, body, "estHardware", parseDecimalValue);
    assignIfPresent(data, body, "estMaintenance", parseDecimalValue);
    assignIfPresent(data, body, "estCostPrice", parseDecimalValue);

    const opportunity = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({ data });

      await tx.opportunityStatusHistory.create({
        data: {
          oppId: created.id,
          fromStatus: null,
          toStatus: "ABERTA",
          changedBy: req.user.name
        }
      });

      return tx.opportunity.findUnique({
        where: { id: created.id },
        select: oppDetailSelect
      });
    });

    return res.status(201).json(serializeOpp(opportunity));
  } catch (err) {
    if (err.message === "invalid_date") {
      return res.status(400).json({ error: "data inválida" });
    }

    if (err.message === "invalid_decimal") {
      return res.status(400).json({ error: "valor decimal inválido" });
    }

    return handlePrismaError(err, res, next);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const opportunity = await findVisibleOpp(req.params.id, req.user, oppDetailSelect);

    if (!opportunity) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json(serializeOpp(opportunity));
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, { id: true, status: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const body = req.body || {};
    const data = {};
    const updatesArchived = Object.prototype.hasOwnProperty.call(body, "archived");

    if (updatesArchived && ["GANHA", "PERDIDA"].includes(existing.status)) {
      return res.status(422).json({ error: "archived_locked_for_terminal_status" });
    }

    assignIfPresent(data, body, "expectedCloseDate", parseDateValue);
    assignIfPresent(data, body, "billingStartDate", parseDateValue);
    assignIfPresent(data, body, "archived", parseBoolean);
    assignIfPresent(data, body, "estServices", parseDecimalValue);
    assignIfPresent(data, body, "estSoftware", parseDecimalValue);
    assignIfPresent(data, body, "estHardware", parseDecimalValue);
    assignIfPresent(data, body, "estMaintenance", parseDecimalValue);
    assignIfPresent(data, body, "estCostPrice", parseDecimalValue);
    assignIfPresent(data, body, "finalServices", parseDecimalValue);
    assignIfPresent(data, body, "finalSoftware", parseDecimalValue);
    assignIfPresent(data, body, "finalHardware", parseDecimalValue);
    assignIfPresent(data, body, "finalMaintenance", parseDecimalValue);
    assignIfPresent(data, body, "realCostPrice", parseDecimalValue);

    if (Object.prototype.hasOwnProperty.call(body, "lossReason")) {
      data.lossReason = body.lossReason;
    }

    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data,
      select: oppDetailSelect
    });

    return res.json(serializeOpp(opportunity));
  } catch (err) {
    if (err.message === "invalid_date") {
      return res.status(400).json({ error: "data inválida" });
    }

    if (err.message === "invalid_decimal") {
      return res.status(400).json({ error: "valor decimal inválido" });
    }

    if (err.message === "invalid_boolean") {
      return res.status(400).json({ error: "archived deve ser true ou false" });
    }

    return handlePrismaError(err, res, next);
  }
});

router.post("/:id/status", async (req, res, next) => {
  try {
    const { toStatus, note, lossReason } = req.body || {};

    if (!toStatus) {
      return res.status(400).json({ error: "toStatus é obrigatório" });
    }

    if (toStatus === "PERDIDA" && !lossReason) {
      return res.status(400).json({ error: "lossReason é obrigatório" });
    }

    const existing = await findVisibleOpp(req.params.id, req.user, { id: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    await transitionStatus(
      prisma,
      req.params.id,
      toStatus,
      req.user.sub,
      req.user.name,
      note,
      lossReason
    );

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      select: oppDetailSelect
    });

    return res.json(serializeOpp(opportunity));
  } catch (err) {
    if (err.message === "not_found") {
      return res.status(404).json({ error: "Not found" });
    }

    if (err.message === "invalid_transition") {
      return res.status(422).json({ error: "invalid_transition" });
    }

    return next(err);
  }
});

router.post("/:id/contacts", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, { id: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const { date, channel, note } = req.body || {};

    if (!date || !channel || !note) {
      return res.status(400).json({ error: "date, channel e note são obrigatórios" });
    }

    const contactDate = parseDateValue(date);

    if (!contactDate) {
      return res.status(400).json({ error: "data inválida" });
    }

    const contact = await prisma.contact.create({
      data: {
        oppId: req.params.id,
        date: contactDate,
        channel,
        note
      },
      select: contactSelect
    });

    return res.status(201).json(contact);
  } catch (err) {
    if (err.message === "invalid_date") {
      return res.status(400).json({ error: "data inválida" });
    }

    return handlePrismaError(err, res, next);
  }
});

router.get("/:id/contacts", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, { id: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const contacts = await prisma.contact.findMany({
      where: { oppId: req.params.id },
      select: contactSelect,
      orderBy: { date: "desc" }
    });

    return res.json(contacts);
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/attachments", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, { id: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}, uploadFile, async (req, res, next) => {
  try {
    const { type } = req.body || {};

    if (!req.file) {
      return res.status(400).json({ error: "file é obrigatório" });
    }

    if (!attachmentTypes.includes(type)) {
      return res.status(400).json({ error: "type inválido" });
    }

    if (type === "PROPOSTA") {
      const adjudicated = await prisma.attachment.findFirst({
        where: {
          oppId: req.params.id,
          type: "PROPOSTA",
          adjudicada: true
        },
        select: { id: true }
      });

      if (adjudicated) {
        return res.status(409).json({ error: "já existe proposta adjudicada" });
      }
    }

    const attachment = await prisma.attachment.create({
      data: {
        oppId: req.params.id,
        type,
        filename: req.file.originalname,
        path: req.file.path,
        adjudicada: false
      },
      select: attachmentSelect
    });

    return res.status(201).json(attachment);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.patch("/:id/attachments/:attId/adjudicar", requireAdmin, async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: req.params.attId,
        oppId: req.params.id
      },
      select: {
        id: true,
        type: true
      }
    });

    if (!attachment || attachment.type !== "PROPOSTA") {
      return res.status(400).json({ error: "attachment inválido" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.attachment.updateMany({
        where: {
          oppId: req.params.id,
          type: "PROPOSTA",
          adjudicada: true,
          id: { not: req.params.attId }
        },
        data: { adjudicada: false }
      });

      return tx.attachment.update({
        where: { id: req.params.attId },
        data: { adjudicada: true },
        select: attachmentSelect
      });
    });

    return res.json(updated);
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.get("/:id/attachments", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, { id: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const attachments = await prisma.attachment.findMany({
      where: { oppId: req.params.id },
      select: attachmentSelect,
      orderBy: { uploadedAt: "asc" }
    });

    return res.json(attachments);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
