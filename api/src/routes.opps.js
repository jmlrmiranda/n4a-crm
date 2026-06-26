const express = require("express");
const fs = require("fs/promises");
const multer = require("multer");
const PDFDocument = require("pdfkit");
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
  companyId: true,
  oppNo: true,
  title: true,
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
  title: true,
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

const oppPdfSelect = {
  ...oppDetailSelect,
  title: true,
  client: {
    select: {
      id: true,
      clientNo: true,
      name: true,
      nif: true,
      responsibleName: true,
      email: true,
      phone: true,
      address: true
    }
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

function canAssignSeller(user) {
  return user && ["ADMIN", "N4A_SUPPORT"].includes(user.role);
}

function visibleOppWhere(id, user, companyId) {
  const where = { id, companyId };

  if (isVendor(user)) {
    where.sellerUserId = user.sub;
  }

  return where;
}

async function findVisibleOpp(id, user, companyId, select) {
  return prisma.opportunity.findFirst({
    where: visibleOppWhere(id, user, companyId),
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

function parseNonNegativeDecimalValue(value) {
  if (value === undefined) {
    throw new Error("invalid_decimal");
  }

  const number = parseDecimalValue(value);

  if (number < 0) {
    throw new Error("invalid_decimal");
  }

  return number;
}

function parseRequiredDateValue(value) {
  const date = parseDateValue(value);

  if (!date) {
    throw new Error("invalid_date");
  }

  return date;
}

function assignIfPresent(data, body, field, parser) {
  if (Object.prototype.hasOwnProperty.call(body, field)) {
    data[field] = parser(body[field]);
  }
}

async function nextOppNo(companyId) {
  const count = await prisma.opportunity.count({ where: { companyId } });
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

async function unlinkFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`Não foi possível remover ficheiro ${filePath}: ${err.message}`);
    }
  }
}

function buildAdjudicationData(body) {
  return {
    finalServices: parseNonNegativeDecimalValue(body.finalServices),
    finalSoftware: parseNonNegativeDecimalValue(body.finalSoftware),
    finalHardware: parseNonNegativeDecimalValue(body.finalHardware),
    finalMaintenance: parseNonNegativeDecimalValue(body.finalMaintenance),
    billingStartDate: parseRequiredDateValue(body.billingStartDate)
  };
}

router.get("/", async (req, res, next) => {
  try {
    const where = { companyId: req.companyId };
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

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        companyId: req.companyId
      },
      select: { id: true }
    });

    if (!client) {
      return res.status(404).json({ error: "Not found" });
    }

    const sellerUserId = canAssignSeller(req.user) && body.sellerUserId ? body.sellerUserId : req.user.sub;

    const seller = await prisma.user.findFirst({
      where: {
        id: sellerUserId,
        companyId: req.companyId,
        isActive: true
      },
      select: { id: true }
    });

    if (!seller) {
      return res.status(404).json({ error: "Not found" });
    }

    const data = {
      companyId: req.companyId,
      oppNo: await nextOppNo(req.companyId),
      clientId,
      sellerUserId,
      saleType,
      status: "ABERTA"
    };

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      data.title = body.title;
    }

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
    const opportunity = await findVisibleOpp(req.params.id, req.user, req.companyId, oppDetailSelect);

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
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true, status: true });

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

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      data.title = body.title;
    }

    if (Object.prototype.hasOwnProperty.call(body, "lossReason")) {
      data.lossReason = body.lossReason;
    }

    const result = await prisma.opportunity.updateMany({
      where: visibleOppWhere(req.params.id, req.user, req.companyId),
      data
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const opportunity = await findVisibleOpp(req.params.id, req.user, req.companyId, oppDetailSelect);

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

    if (toStatus === "GANHA") {
      return res.status(422).json({ error: "ganha_requer_adjudicacao" });
    }

    if (toStatus === "PERDIDA" && !lossReason) {
      return res.status(400).json({ error: "lossReason é obrigatório" });
    }

    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true });

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
      lossReason,
      req.companyId
    );

    const opportunity = await findVisibleOpp(req.params.id, req.user, req.companyId, oppDetailSelect);

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
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true });

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

router.get("/:id/similar", async (req, res, next) => {
  try {
    const opp = await findVisibleOpp(req.params.id, req.user, req.companyId, {
      id: true,
      clientId: true,
      saleType: true
    });

    if (!opp) {
      return res.status(404).json({ error: "Not found" });
    }

    const where = {
      companyId: req.companyId,
      clientId: opp.clientId,
      saleType: opp.saleType,
      id: { not: opp.id }
    };

    if (isVendor(req.user)) {
      where.sellerUserId = req.user.sub;
    }

    const similar = await prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        oppNo: true,
        title: true,
        status: true,
        saleType: true,
        estServices: true,
        estSoftware: true,
        estHardware: true,
        estMaintenance: true,
        finalServices: true,
        finalSoftware: true,
        finalHardware: true,
        finalMaintenance: true,
        expectedCloseDate: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json(similar.map(serializeOpp));
  } catch (err) {
    return next(err);
  }
});

router.get("/:id/contacts", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true });

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
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true, status: true });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    req.visibleOpportunity = existing;
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
      await unlinkFile(req.file.path);
      return res.status(400).json({ error: "type inválido" });
    }

    if (type === "PROPOSTA") {
      if (req.visibleOpportunity.status === "GANHA") {
        await unlinkFile(req.file.path);
        return res.status(409).json({ error: "desadjudique antes de substituir a proposta" });
      }

      let oldProposalPaths = [];
      const attachment = await prisma.$transaction(async (tx) => {
        const oldProposals = await tx.attachment.findMany({
          where: {
            oppId: req.params.id,
            type: "PROPOSTA"
          },
          select: {
            id: true,
            path: true
          }
        });

        oldProposalPaths = oldProposals.map((proposal) => proposal.path).filter(Boolean);

        if (oldProposals.length > 0) {
          await tx.attachment.deleteMany({
            where: {
              oppId: req.params.id,
              type: "PROPOSTA"
            }
          });
        }

        return tx.attachment.create({
          data: {
            oppId: req.params.id,
            type,
            filename: req.file.originalname,
            path: req.file.path,
            adjudicada: false
          },
          select: attachmentSelect
        });
      });

      await Promise.all(oldProposalPaths.map((filePath) => unlinkFile(filePath)));

      return res.status(201).json(attachment);
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
    await unlinkFile(req.file?.path);
    return handlePrismaError(err, res, next);
  }
});

router.patch("/:id/attachments/:attId/adjudicar", requireAdmin, async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, {
      id: true,
      status: true
    });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    if (existing.status === "PERDIDA") {
      return res.status(422).json({ error: "oportunidade_perdida" });
    }

    if (existing.status === "GANHA") {
      return res.status(409).json({ error: "oportunidade_ja_ganha" });
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: req.params.attId,
        oppId: req.params.id
      },
      select: {
        id: true,
        type: true,
        filename: true
      }
    });

    if (!attachment || attachment.type !== "PROPOSTA") {
      return res.status(400).json({ error: "attachment inválido" });
    }

    const adjudicationData = buildAdjudicationData(req.body || {});

    const opportunity = await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: req.params.id },
        data: {
          ...adjudicationData,
          status: "GANHA",
          archived: false,
          lossReason: null
        }
      });

      await tx.attachment.updateMany({
        where: {
          oppId: req.params.id,
          type: "PROPOSTA",
          id: { not: req.params.attId }
        },
        data: { adjudicada: false }
      });

      await tx.attachment.update({
        where: { id: req.params.attId },
        data: { adjudicada: true }
      });

      await tx.opportunityStatusHistory.create({
        data: {
          oppId: req.params.id,
          fromStatus: existing.status,
          toStatus: "GANHA",
          note: `Proposta adjudicada: ${attachment.filename}`,
          changedBy: req.user.name
        }
      });

      return tx.opportunity.findUnique({
        where: { id: req.params.id },
        select: oppDetailSelect
      });
    });

    return res.json(serializeOpp(opportunity));
  } catch (err) {
    if (err.message === "invalid_date") {
      return res.status(400).json({ error: "billingStartDate inválida" });
    }

    if (err.message === "invalid_decimal") {
      return res.status(400).json({ error: "valores finais inválidos" });
    }

    return handlePrismaError(err, res, next);
  }
});

router.patch("/:id/attachments/:attId/desadjudicar", requireAdmin, async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, {
      id: true,
      status: true,
      realCostPrice: true
    });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: req.params.attId,
        oppId: req.params.id
      },
      select: {
        id: true,
        type: true,
        adjudicada: true
      }
    });

    if (!attachment || attachment.type !== "PROPOSTA") {
      return res.status(400).json({ error: "attachment inválido" });
    }

    if (!attachment.adjudicada) {
      return res.status(409).json({ error: "proposta_nao_adjudicada" });
    }

    if (Number(existing.realCostPrice || 0) > 0) {
      return res.status(409).json({ error: "desadjudicacao_bloqueada_por_custo_real" });
    }

    const deliveryDocument = await prisma.attachment.findFirst({
      where: {
        oppId: req.params.id,
        type: { in: ["COMPRA", "FATURA"] }
      },
      select: { id: true }
    });

    if (deliveryDocument) {
      return res.status(409).json({ error: "desadjudicacao_bloqueada_por_documentos" });
    }

    const opportunity = await prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id: req.params.attId },
        data: { adjudicada: false }
      });

      await tx.opportunity.update({
        where: { id: req.params.id },
        data: {
          status: "NEGOCIACAO",
          archived: false,
          lossReason: null
        }
      });

      await tx.opportunityStatusHistory.create({
        data: {
          oppId: req.params.id,
          fromStatus: existing.status,
          toStatus: "NEGOCIACAO",
          note: "Adjudicação revertida",
          changedBy: req.user.name
        }
      });

      return tx.opportunity.findUnique({
        where: { id: req.params.id },
        select: oppDetailSelect
      });
    });

    return res.json(serializeOpp(opportunity));
  } catch (err) {
    return handlePrismaError(err, res, next);
  }
});

router.get("/:id/attachments", async (req, res, next) => {
  try {
    const existing = await findVisibleOpp(req.params.id, req.user, req.companyId, { id: true });

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

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const opp = await findVisibleOpp(req.params.id, req.user, req.companyId, oppPdfSelect);

    if (!opp) {
      return res.status(404).json({ error: "Not found" });
    }

    const data = serializeOpp(opp);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const filename = `oportunidade-${data.oppNo}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const eur = (v) =>
      new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(v || 0));
    const dt = (v) =>
      v
        ? new Intl.DateTimeFormat("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }).format(new Date(v))
        : "—";
    const MAGENTA = "#e91e8c";
    const MUTED = "#666666";

    // Cabeçalho
    doc
      .fillColor(MAGENTA)
      .fontSize(20)
      .text("N4A", { continued: true })
      .fillColor("#000000")
      .fontSize(12)
      .text("  ·  Ficha de Oportunidade");
    doc.moveDown(0.2);
    doc.fillColor(MUTED).fontSize(8).text("DOCUMENTO INTERNO · CONFIDENCIAL · NÃO DISTRIBUIR AO CLIENTE");
    doc.moveDown(0.5);
    doc.fillColor("#000000").fontSize(14).text(`${data.oppNo} — ${data.client?.name || "Cliente"}`);
    doc.fillColor(MUTED).fontSize(8).text(`Gerado em ${dt(new Date())}`);
    doc.moveDown(1);

    // Helper de secção
    const section = (title) => {
      doc.moveDown(0.6);
      doc.fillColor(MAGENTA).fontSize(11).text(title.toUpperCase());
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor(MAGENTA).lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc.fillColor("#000000").fontSize(10);
    };
    const row = (label, value) => {
      doc
        .fontSize(10)
        .fillColor(MUTED)
        .text(label, { continued: true, width: 200 })
        .fillColor("#000000")
        .text(`   ${value}`);
    };

    // Cliente
    section("Cliente");
    row("Nome", data.client?.name || "—");
    row("NIF", data.client?.nif || "—");
    row("Responsável", data.client?.responsibleName || "—");
    row("Email", data.client?.email || "—");
    row("Telefone", data.client?.phone || "—");
    row("Morada", data.client?.address || "—");

    // Oportunidade
    section("Oportunidade");
    row("Tipo de venda", data.saleType);
    row("Estado", data.status);
    row("Vendedor", data.seller?.name || "—");
    row("Fecho esperado", dt(data.expectedCloseDate));
    row("Proposta enviada", dt(data.proposalSentDate));

    if (data.lossReason) {
      row("Motivo de perda", data.lossReason);
    }

    // Financeiro estimado
    section("Financeiro estimado");
    row("Serviços", eur(data.estServices));
    row("Software", eur(data.estSoftware));
    row("Hardware", eur(data.estHardware));
    row("Manutenção", eur(data.estMaintenance));
    doc.moveDown(0.2);
    row("Venda estimada", eur(data.estSellPrice));
    row("Custo estimado", eur(data.estCostPrice));
    row("Margem prevista", `${eur(data.estGrossMargin)}  (${data.estGrossMarginPct}%)`);

    // Financeiro final
    if (data.status === "GANHA") {
      section("Financeiro final");
      row("Serviços", eur(data.finalServices));
      row("Software", eur(data.finalSoftware));
      row("Hardware", eur(data.finalHardware));
      row("Manutenção", eur(data.finalMaintenance));
      doc.moveDown(0.2);
      row("Venda final", eur(data.finalSellPrice));
      row("Custo real", eur(data.realCostPrice));
      row("Margem efectiva", `${eur(data.finalMargin)}  (${data.finalMarginPct}%)`);
    }

    // Rodapé
    doc.moveDown(2);
    doc
      .fillColor(MUTED)
      .fontSize(7)
      .text("N4A CRM · Ficha gerada automaticamente · Uso interno", 50, 800, {
        align: "center",
        width: 495
      });

    return doc.end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
