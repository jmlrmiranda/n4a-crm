const {
  calcEstSellPrice,
  calcFinalSellPrice,
  calcEstMargin,
  calcFinalMargin,
  calcEstMarginPct,
  calcFinalMarginPct,
  serializeOpp
} = require("../src/finance");

function decimalLike(value) {
  return {
    toString() {
      return String(value);
    }
  };
}

describe("finance", () => {
  describe("calcEstSellPrice", () => {
    test("soma os 4 componentes correctamente", () => {
      expect(calcEstSellPrice({
        estServices: 10,
        estSoftware: 20,
        estHardware: 30,
        estMaintenance: 40
      })).toBe(100);
    });

    test("retorna 0 quando todos os campos são 0", () => {
      expect(calcEstSellPrice({
        estServices: 0,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0
      })).toBe(0);
    });

    test("trata campos null como 0", () => {
      expect(calcEstSellPrice({
        estServices: null,
        estSoftware: 20,
        estHardware: null,
        estMaintenance: 5
      })).toBe(25);
    });

    test("trata campos Decimal-like correctamente", () => {
      expect(calcEstSellPrice({
        estServices: decimalLike(10.5),
        estSoftware: decimalLike(20),
        estHardware: decimalLike(1.25),
        estMaintenance: decimalLike(3.25)
      })).toBe(35);
    });
  });

  describe("calcFinalSellPrice", () => {
    test("soma os 4 componentes correctamente", () => {
      expect(calcFinalSellPrice({
        finalServices: 10,
        finalSoftware: 20,
        finalHardware: 30,
        finalMaintenance: 40
      })).toBe(100);
    });

    test("retorna 0 quando todos os campos são 0", () => {
      expect(calcFinalSellPrice({
        finalServices: 0,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0
      })).toBe(0);
    });

    test("trata campos null como 0", () => {
      expect(calcFinalSellPrice({
        finalServices: null,
        finalSoftware: 20,
        finalHardware: null,
        finalMaintenance: 5
      })).toBe(25);
    });

    test("trata campos Decimal-like correctamente", () => {
      expect(calcFinalSellPrice({
        finalServices: decimalLike(10.5),
        finalSoftware: decimalLike(20),
        finalHardware: decimalLike(1.25),
        finalMaintenance: decimalLike(3.25)
      })).toBe(35);
    });
  });

  describe("calcEstMargin", () => {
    test("calcula margem positiva", () => {
      expect(calcEstMargin({
        estServices: 50,
        estSoftware: 50,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 40
      })).toBe(60);
    });

    test("calcula margem negativa quando custo > preço", () => {
      expect(calcEstMargin({
        estServices: 25,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 40
      })).toBe(-15);
    });

    test("retorna 0 quando tudo é 0", () => {
      expect(calcEstMargin({
        estServices: 0,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 0
      })).toBe(0);
    });
  });

  describe("calcFinalMargin", () => {
    test("calcula margem positiva", () => {
      expect(calcFinalMargin({
        finalServices: 50,
        finalSoftware: 50,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 40
      })).toBe(60);
    });

    test("calcula margem negativa quando custo > preço", () => {
      expect(calcFinalMargin({
        finalServices: 25,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 40
      })).toBe(-15);
    });

    test("retorna 0 quando tudo é 0", () => {
      expect(calcFinalMargin({
        finalServices: 0,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 0
      })).toBe(0);
    });
  });

  describe("calcEstMarginPct", () => {
    test("calcula percentagem com preço > 0", () => {
      expect(calcEstMarginPct({
        estServices: 100,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 25
      })).toBe(75);
    });

    test("retorna 0 quando preço = 0", () => {
      expect(calcEstMarginPct({
        estServices: 0,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 25
      })).toBe(0);
    });

    test("arredonda a 2 casas decimais", () => {
      expect(calcEstMarginPct({
        estServices: 3,
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 2
      })).toBe(33.33);
    });
  });

  describe("calcFinalMarginPct", () => {
    test("calcula percentagem com preço > 0", () => {
      expect(calcFinalMarginPct({
        finalServices: 100,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 25
      })).toBe(75);
    });

    test("retorna 0 quando preço = 0", () => {
      expect(calcFinalMarginPct({
        finalServices: 0,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 25
      })).toBe(0);
    });

    test("arredonda a 2 casas decimais", () => {
      expect(calcFinalMarginPct({
        finalServices: 3,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 2
      })).toBe(33.33);
    });
  });

  describe("serializeOpp", () => {
    test("retorna null se opp for null", () => {
      expect(serializeOpp(null)).toBeNull();
    });

    test("converte Decimal para Number e adiciona campos calculados", () => {
      const opp = {
        id: "opp1",
        estServices: decimalLike(100),
        estSoftware: decimalLike(50),
        estHardware: decimalLike(25),
        estMaintenance: decimalLike(25),
        estCostPrice: decimalLike(120),
        finalServices: decimalLike(90),
        finalSoftware: decimalLike(40),
        finalHardware: decimalLike(20),
        finalMaintenance: decimalLike(10),
        realCostPrice: decimalLike(100)
      };

      const result = serializeOpp(opp);

      expect(result.estServices).toBe(100);
      expect(result.estSellPrice).toBe(200);
      expect(result.finalSellPrice).toBe(160);
      expect(result.estGrossMargin).toBe(80);
      expect(result.finalMargin).toBe(60);
      expect(result.estGrossMarginPct).toBe(40);
      expect(result.finalMarginPct).toBe(37.5);
    });

    test("não muta o objecto original", () => {
      const opp = {
        estServices: decimalLike(100),
        estSoftware: 0,
        estHardware: 0,
        estMaintenance: 0,
        estCostPrice: 50,
        finalServices: 0,
        finalSoftware: 0,
        finalHardware: 0,
        finalMaintenance: 0,
        realCostPrice: 0
      };

      const originalEstServices = opp.estServices;
      const result = serializeOpp(opp);

      expect(result).not.toBe(opp);
      expect(opp.estServices).toBe(originalEstServices);
      expect(opp.estSellPrice).toBeUndefined();
    });
  });
});
