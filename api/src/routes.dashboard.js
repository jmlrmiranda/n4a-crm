const express = require("express");
const prisma = require("./prisma");
const { calcEstSellPrice, calcFinalSellPrice } = require("./finance");

const router = express.Router();

const ACTIVE_STATUSES = ["ABERTA", "PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];
const FORECAST_STATUSES = ["PROPOSTA_ENVIADA", "NEGOCIACAO"];
const FORECAST_WEIGHTS = {
  PROPOSTA_ENVIADA: 0.3,
  NEGOCIACAO: 0.7
};
const DECIMAL_FIELDS = [
  "estServices",
  "estSoftware",
  "estHardware",
  "estMaintenance",
  "finalServices",
  "finalSoftware",
  "finalHardware",
  "finalMaintenance",
  "realCostPrice"
];

const pipelineSelect = {
  id: true,
  companyId: true,
  saleType: true,
  sellerUserId: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true,
  seller: {
    select: {
      id: true,
      name: true
    }
  }
};

const wonSelect = {
  id: true,
  companyId: true,
  saleType: true,
  sellerUserId: true,
  finalServices: true,
  finalSoftware: true,
  finalHardware: true,
  finalMaintenance: true,
  realCostPrice: true,
  seller: {
    select: {
      id: true,
      name: true
    }
  }
};

const lostSelect = {
  id: true,
  companyId: true,
  saleType: true,
  sellerUserId: true,
  seller: {
    select: {
      id: true,
      name: true
    }
  }
};

const forecastSelect = {
  id: true,
  companyId: true,
  status: true,
  expectedCloseDate: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true
};

const groupSelect = {
  id: true,
  companyId: true,
  status: true,
  saleType: true,
  sellerUserId: true,
  estServices: true,
  estSoftware: true,
  estHardware: true,
  estMaintenance: true,
  finalServices: true,
  finalSoftware: true,
  finalHardware: true,
  finalMaintenance: true,
  realCostPrice: true,
  seller: {
    select: {
      id: true,
      name: true
    }
  }
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function period(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeOpp(opp) {
  const normalized = { ...opp };

  for (const field of DECIMAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = Number(normalized[field]);
    }
  }

  return normalized;
}

function finalMargin(opp) {
  const normalized = normalizeOpp(opp);
  return calcFinalSellPrice(normalized) - Number(normalized.realCostPrice || 0);
}

function pct(part, total) {
  if (total === 0) {
    return 0;
  }

  return round2((part / total) * 100);
}

function sellerKey(opp) {
  return opp.seller ? opp.seller.id : opp.sellerUserId;
}

function sellerName(opp) {
  return opp.seller ? opp.seller.name : "";
}

function ensureSeller(map, opp) {
  const key = sellerKey(opp);

  if (!map.has(key)) {
    map.set(key, {
      seller_id: key,
      seller_name: sellerName(opp),
      pipeline_total: 0,
      pipeline_count: 0,
      won_revenue: 0,
      won_margin: 0,
      won_count: 0,
      lost_count: 0
    });
  }

  return map.get(key);
}

function ensureType(map, saleType) {
  if (!map.has(saleType)) {
    map.set(saleType, {
      sale_type: saleType,
      pipeline_total: 0,
      won_revenue: 0
    });
  }

  return map.get(saleType);
}

router.get("/", async (req, res, next) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const wonFrom = dateFrom ?? twelveMonthsAgo;
    const wonTo = dateTo ?? now;
    const lostFrom = dateFrom ?? twelveMonthsAgo;
    const lostTo = dateTo ?? now;

    const next30 = addDays(now, 30);
    const next60 = addDays(now, 60);
    const next90 = addDays(now, 90);

    const [
      pipelineOpps,
      wonOpps,
      lostOpps,
      forecastOpps,
      bySellerOpps,
      byTypeOpps
    ] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          status: { in: ACTIVE_STATUSES }
        },
        select: pipelineSelect
      }),
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          status: "GANHA",
          updatedAt: { gte: wonFrom, lte: wonTo }
        },
        select: wonSelect
      }),
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          status: "PERDIDA",
          updatedAt: { gte: lostFrom, lte: lostTo }
        },
        select: lostSelect
      }),
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          status: { in: FORECAST_STATUSES },
          expectedCloseDate: {
            gte: now,
            lte: next90
          }
        },
        select: forecastSelect
      }),
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          OR: [
            { status: { in: ACTIVE_STATUSES } },
            { status: "GANHA", updatedAt: { gte: wonFrom, lte: wonTo } },
            { status: "PERDIDA", updatedAt: { gte: lostFrom, lte: lostTo } }
          ]
        },
        select: groupSelect
      }),
      prisma.opportunity.findMany({
        where: {
          companyId: req.companyId,
          OR: [
            { status: { in: ACTIVE_STATUSES } },
            { status: "GANHA", updatedAt: { gte: wonFrom, lte: wonTo } },
            { status: "PERDIDA", updatedAt: { gte: lostFrom, lte: lostTo } }
          ]
        },
        select: groupSelect
      })
    ]);

    const pipelineTotal = pipelineOpps
      .map(normalizeOpp)
      .reduce((sum, opp) => sum + calcEstSellPrice(opp), 0);

    const wonRevenue = wonOpps
      .map(normalizeOpp)
      .reduce((sum, opp) => sum + calcFinalSellPrice(opp), 0);

    const wonMargin = wonOpps.reduce((sum, opp) => sum + finalMargin(opp), 0);

    const forecast = forecastOpps.map(normalizeOpp).reduce((acc, opp) => {
      const weighted = calcEstSellPrice(opp) * FORECAST_WEIGHTS[opp.status];

      if (opp.expectedCloseDate <= next30) {
        acc.next_30 += weighted;
      }

      if (opp.expectedCloseDate <= next60) {
        acc.next_60 += weighted;
      }

      acc.next_90 += weighted;
      return acc;
    }, { next_30: 0, next_60: 0, next_90: 0 });

    const sellerMap = new Map();

    for (const opp of bySellerOpps.map(normalizeOpp)) {
      const seller = ensureSeller(sellerMap, opp);

      if (ACTIVE_STATUSES.includes(opp.status)) {
        seller.pipeline_count += 1;
        seller.pipeline_total += calcEstSellPrice(opp);
      }

      if (opp.status === "GANHA") {
        seller.won_count += 1;
        seller.won_revenue += calcFinalSellPrice(opp);
        seller.won_margin += finalMargin(opp);
      }

      if (opp.status === "PERDIDA") {
        seller.lost_count += 1;
      }
    }

    const bySeller = Array.from(sellerMap.values())
      .filter((seller) => seller.pipeline_count > 0 || seller.won_count > 0)
      .map((seller) => ({
        seller_id: seller.seller_id,
        seller_name: seller.seller_name,
        pipeline_total: round2(seller.pipeline_total),
        won_revenue: round2(seller.won_revenue),
        won_margin: round2(seller.won_margin),
        win_rate: pct(seller.won_count, seller.won_count + seller.lost_count)
      }))
      .sort((a, b) => a.seller_name.localeCompare(b.seller_name));

    const typeMap = new Map();

    for (const opp of byTypeOpps.map(normalizeOpp)) {
      const type = ensureType(typeMap, opp.saleType);

      if (ACTIVE_STATUSES.includes(opp.status)) {
        type.pipeline_total += calcEstSellPrice(opp);
      }

      if (opp.status === "GANHA") {
        type.won_revenue += calcFinalSellPrice(opp);
      }
    }

    const byType = Array.from(typeMap.values())
      .map((type) => ({
        sale_type: type.sale_type,
        pipeline_total: round2(type.pipeline_total),
        won_revenue: round2(type.won_revenue)
      }))
      .sort((a, b) => a.sale_type.localeCompare(b.sale_type));

    return res.json({
      company_id: req.company.id,
      company_name: req.company.name,
      period: period(now),
      date_from: dateFrom ? dateFrom.toISOString().slice(0, 10) : null,
      date_to: dateTo ? dateTo.toISOString().slice(0, 10) : null,
      pipeline_total: round2(pipelineTotal),
      pipeline_count: pipelineOpps.length,
      won_revenue: round2(wonRevenue),
      won_count: wonOpps.length,
      won_margin: round2(wonMargin),
      won_margin_pct: pct(wonMargin, wonRevenue),
      lost_count: lostOpps.length,
      win_rate: pct(wonOpps.length, wonOpps.length + lostOpps.length),
      forecast: {
        next_30: round2(forecast.next_30),
        next_60: round2(forecast.next_60),
        next_90: round2(forecast.next_90)
      },
      by_seller: bySeller,
      by_type: byType
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
