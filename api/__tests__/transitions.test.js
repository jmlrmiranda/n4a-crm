const { isValidTransition, transitionStatus } = require("../src/transitions");

function createMockPrisma(opportunity) {
  const updatedOpportunity = {
    id: "opp1",
    status: "UPDATED",
    statusHistory: []
  };
  const tx = {
    opportunity: {
      update: jest.fn().mockResolvedValue({ id: "opp1" }),
      findUnique: jest.fn().mockResolvedValue(updatedOpportunity)
    },
    opportunityStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: "hist1" })
    }
  };
  const prisma = {
    opportunity: {
      findFirst: jest.fn().mockResolvedValue(opportunity)
    },
    $transaction: jest.fn(async (callback) => callback(tx))
  };

  return { prisma, tx, updatedOpportunity };
}

describe("transitions", () => {
  describe("isValidTransition", () => {
    test.each([
      ["ABERTA", "PROPOSTA_EM_PREPARACAO"],
      ["ABERTA", "PERDIDA"],
      ["PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA"],
      ["PROPOSTA_EM_PREPARACAO", "PERDIDA"],
      ["PROPOSTA_ENVIADA", "NEGOCIACAO"],
      ["PROPOSTA_ENVIADA", "GANHA"],
      ["PROPOSTA_ENVIADA", "PERDIDA"],
      ["NEGOCIACAO", "GANHA"],
      ["NEGOCIACAO", "PERDIDA"]
    ])("%s -> %s é válida", (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    test.each([
      ["GANHA", "ABERTA"],
      ["PERDIDA", "NEGOCIACAO"],
      ["ABERTA", "GANHA"],
      ["NEGOCIACAO", "PROPOSTA_ENVIADA"]
    ])("%s -> %s é inválida", (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });

    test("estados terminais não têm transições", () => {
      expect(isValidTransition("GANHA", "PERDIDA")).toBe(false);
      expect(isValidTransition("PERDIDA", "GANHA")).toBe(false);
    });

    test("status inválido como origem retorna false", () => {
      expect(isValidTransition("INVALIDO", "GANHA")).toBe(false);
    });
  });

  describe("transitionStatus", () => {
    test("transição válida chama update e create dentro da transacção", async () => {
      const { prisma, tx, updatedOpportunity } = createMockPrisma({
        id: "opp1",
        status: "ABERTA",
        proposalSentDate: null
      });

      const result = await transitionStatus(prisma, "opp1", "PERDIDA", "user1", "Ana", "nota", "perdida");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: {
          status: "PERDIDA",
          archived: true,
          lossReason: "perdida"
        }
      });
      expect(tx.opportunityStatusHistory.create).toHaveBeenCalledWith({
        data: {
          oppId: "opp1",
          fromStatus: "ABERTA",
          toStatus: "PERDIDA",
          note: "nota",
          changedBy: "Ana"
        }
      });
      expect(result).toBe(updatedOpportunity);
    });

    test("lança not_found quando oportunidade não existe", async () => {
      const { prisma } = createMockPrisma(null);

      await expect(transitionStatus(prisma, "opp1", "PERDIDA", "user1", "Ana"))
        .rejects
        .toThrow("not_found");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("lança invalid_transition quando transição não é permitida", async () => {
      const { prisma } = createMockPrisma({
        id: "opp1",
        status: "GANHA",
        proposalSentDate: null
      });

      await expect(transitionStatus(prisma, "opp1", "ABERTA", "user1", "Ana"))
        .rejects
        .toThrow("invalid_transition");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("PROPOSTA_ENVIADA com proposalSentDate null inclui proposalSentDate", async () => {
      const { prisma, tx } = createMockPrisma({
        id: "opp1",
        status: "PROPOSTA_EM_PREPARACAO",
        proposalSentDate: null
      });

      await transitionStatus(prisma, "opp1", "PROPOSTA_ENVIADA", "user1", "Ana");

      expect(tx.opportunity.update.mock.calls[0][0].data.status).toBe("PROPOSTA_ENVIADA");
      expect(tx.opportunity.update.mock.calls[0][0].data.proposalSentDate).toBeInstanceOf(Date);
    });

    test("PROPOSTA_ENVIADA com proposalSentDate preenchido não inclui proposalSentDate", async () => {
      const existingDate = new Date("2026-01-01T00:00:00.000Z");
      const { prisma, tx } = createMockPrisma({
        id: "opp1",
        status: "PROPOSTA_EM_PREPARACAO",
        proposalSentDate: existingDate
      });

      await transitionStatus(prisma, "opp1", "PROPOSTA_ENVIADA", "user1", "Ana");

      expect(tx.opportunity.update.mock.calls[0][0].data).toEqual({
        status: "PROPOSTA_ENVIADA"
      });
    });

    test("GANHA inclui archived=false e lossReason=null", async () => {
      const { prisma, tx } = createMockPrisma({
        id: "opp1",
        status: "NEGOCIACAO",
        proposalSentDate: null
      });

      await transitionStatus(prisma, "opp1", "GANHA", "user1", "Ana");

      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: {
          status: "GANHA",
          archived: false,
          lossReason: null
        }
      });
    });

    test("PERDIDA inclui archived=true", async () => {
      const { prisma, tx } = createMockPrisma({
        id: "opp1",
        status: "NEGOCIACAO",
        proposalSentDate: null
      });

      await transitionStatus(prisma, "opp1", "PERDIDA", "user1", "Ana");

      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: {
          status: "PERDIDA",
          archived: true
        }
      });
    });

    test("PERDIDA com lossReason inclui lossReason", async () => {
      const { prisma, tx } = createMockPrisma({
        id: "opp1",
        status: "NEGOCIACAO",
        proposalSentDate: null
      });

      await transitionStatus(prisma, "opp1", "PERDIDA", "user1", "Ana", undefined, "Cliente recusou");

      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: {
          status: "PERDIDA",
          archived: true,
          lossReason: "Cliente recusou"
        }
      });
    });
  });
});
