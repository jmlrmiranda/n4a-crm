const decimalFields = [
  "estServices",
  "estSoftware",
  "estHardware",
  "estMaintenance",
  "finalServices",
  "finalSoftware",
  "finalHardware",
  "finalMaintenance",
  "estCostPrice",
  "realCostPrice"
];

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calcEstSellPrice(opp) {
  return (
    toNumber(opp.estServices) +
    toNumber(opp.estSoftware) +
    toNumber(opp.estHardware) +
    toNumber(opp.estMaintenance)
  );
}

function calcFinalSellPrice(opp) {
  return (
    toNumber(opp.finalServices) +
    toNumber(opp.finalSoftware) +
    toNumber(opp.finalHardware) +
    toNumber(opp.finalMaintenance)
  );
}

function calcEstMargin(opp) {
  return calcEstSellPrice(opp) - toNumber(opp.estCostPrice);
}

function calcFinalMargin(opp) {
  return calcFinalSellPrice(opp) - toNumber(opp.realCostPrice);
}

function calcEstMarginPct(opp) {
  const sellPrice = calcEstSellPrice(opp);

  if (sellPrice === 0) {
    return 0;
  }

  return round2((calcEstMargin(opp) / sellPrice) * 100);
}

function calcFinalMarginPct(opp) {
  const sellPrice = calcFinalSellPrice(opp);

  if (sellPrice === 0) {
    return 0;
  }

  return round2((calcFinalMargin(opp) / sellPrice) * 100);
}

function serializeOpp(opp) {
  if (!opp) {
    return null;
  }

  const serialized = { ...opp };

  for (const field of decimalFields) {
    if (Object.prototype.hasOwnProperty.call(serialized, field)) {
      serialized[field] = toNumber(serialized[field]);
    }
  }

  serialized.estSellPrice = calcEstSellPrice(serialized);
  serialized.finalSellPrice = calcFinalSellPrice(serialized);
  serialized.estGrossMargin = calcEstMargin(serialized);
  serialized.finalMargin = calcFinalMargin(serialized);
  serialized.estGrossMarginPct = calcEstMarginPct(serialized);
  serialized.finalMarginPct = calcFinalMarginPct(serialized);

  return serialized;
}

module.exports = {
  calcEstSellPrice,
  calcFinalSellPrice,
  calcEstMargin,
  calcFinalMargin,
  calcEstMarginPct,
  calcFinalMarginPct,
  serializeOpp
};
