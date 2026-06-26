process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.PORT = "18080";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = "/tmp";

const fs = require("fs/promises");
const request = require("supertest");

jest.mock("../src/prisma", () => ({
  company: {
    findUnique: jest.fn()
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  client: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  opportunity: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  opportunityStatusHistory: {
    create: jest.fn()
  },
  contact: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  attachment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn()
  },
  $transaction: jest.fn()
}));

jest.mock("../src/transitions", () => ({
  transitionStatus: jest.fn()
}));

const prisma = require("../src/prisma");
const { transitionStatus } = require("../src/transitions");
const app = require("../src/index");
const { signToken } = require("../src/auth");

const adminToken = signToken({
  sub: "admin1",
  name: "Admin",
  email: "admin@n4a.pt",
  role: "ADMIN",
  companyId: "company1"
});

const vendorToken = signToken({
  sub: "seller1",
  name: "Vendedor",
  email: "seller@n4a.pt",
  role: "VENDEDOR",
  companyId: "company1"
});

const otherTenantAdminToken = signToken({
  sub: "admin2",
  name: "Admin Cliente",
  email: "admin@cliente-demo.test",
  role: "ADMIN",
  companyId: "company2"
});

function auth(token = adminToken) {
  return `Bearer ${token}`;
}

function oppFixture(overrides = {}) {
  return {
    id: "opp1",
    companyId: "company1",
    oppNo: "O00001",
    clientId: "client1",
    sellerUserId: "seller1",
    saleType: "PROJETO",
    status: "ABERTA",
    archived: false,
    estServices: "100.00",
    estSoftware: "50.00",
    estHardware: "25.00",
    estMaintenance: "10.00",
    estCostPrice: "80.00",
    finalServices: "0.00",
    finalSoftware: "0.00",
    finalHardware: "0.00",
    finalMaintenance: "0.00",
    realCostPrice: "0.00",
    lossReason: null,
    expectedCloseDate: "2026-07-01T10:00:00.000Z",
    billingStartDate: null,
    proposalSentDate: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    client: {
      id: "client1",
      clientNo: "C0001",
      name: "Cliente A"
    },
    seller: {
      id: "seller1",
      name: "Vendedor"
    },
    statusHistory: [],
    attachments: [],
    contacts: [],
    ...overrides
  };
}

function transactionPrisma(created, detail) {
  return {
    opportunity: {
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockResolvedValue({ id: detail.id }),
      findUnique: jest.fn().mockResolvedValue(detail)
    },
    opportunityStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: "hist1" })
    },
    attachment: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({
        id: "att1",
        type: "PROPOSTA",
        filename: "proposal.pdf",
        adjudicada: false,
        uploadedAt: "2026-06-22T10:00:00.000Z"
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({
        id: "att1",
        type: "PROPOSTA",
        filename: "proposal.pdf",
        adjudicada: true,
        uploadedAt: "2026-06-22T10:00:00.000Z"
      })
    }
  };
}

describe("routes opps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined);
    prisma.company.findUnique.mockImplementation(({ where }) => Promise.resolve({
      id: where.id,
      name: where.id === "company2" ? "Cliente Demo" : "N4A",
      slug: where.id === "company2" ? "cliente-demo" : "n4a",
      isActive: true
    }));
    prisma.user.findFirst.mockResolvedValue({ id: "seller1" });
    prisma.opportunity.count.mockResolvedValue(0);
    prisma.opportunity.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback) => callback(transactionPrisma(
      { id: "opp-created" },
      oppFixture({ id: "opp-created", oppNo: "O00001" })
    )));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/opps", () => {
    test("401 sem token", async () => {
      const res = await request(app).get("/api/opps");

      expect(res.status).toBe(401);
    });

    test("200 com lista (ADMIN vê todas)", async () => {
      prisma.opportunity.findMany.mockResolvedValue([
        oppFixture({ id: "opp1", sellerUserId: "seller1" }),
        oppFixture({ id: "opp2", oppNo: "O00002", sellerUserId: "seller2" })
      ]);

      const res = await request(app)
        .get("/api/opps")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual(expect.objectContaining({
        estServices: 100,
        estSellPrice: 185,
        estGrossMargin: 105
      }));
      expect(prisma.opportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { companyId: "company1" }
      }));
    });

    test("VENDEDOR recebe só as suas dentro da company", async () => {
      const allOpps = [
        oppFixture({ id: "opp1", sellerUserId: "seller1" }),
        oppFixture({ id: "opp2", oppNo: "O00002", sellerUserId: "seller2" })
      ];
      prisma.opportunity.findMany.mockImplementation(({ where }) =>
        Promise.resolve(allOpps.filter((opp) => opp.sellerUserId === where.sellerUserId))
      );

      const res = await request(app)
        .get("/api/opps")
        .set("Authorization", auth(vendorToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].sellerUserId).toBe("seller1");
      expect(prisma.opportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { companyId: "company1", sellerUserId: "seller1" }
      }));
    });

    test("admin de outro tenant não recebe oportunidades da N4A", async () => {
      const allOpps = [
        oppFixture({ id: "opp1", companyId: "company1", sellerUserId: "seller1" }),
        oppFixture({ id: "opp2", companyId: "company2", oppNo: "O00002", sellerUserId: "seller2" })
      ];
      prisma.opportunity.findMany.mockImplementation(({ where }) =>
        Promise.resolve(allOpps.filter((opp) => opp.companyId === where.companyId))
      );

      const res = await request(app)
        .get("/api/opps")
        .set("Authorization", auth(otherTenantAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({
        id: "opp2",
        companyId: "company2"
      }));
      expect(res.body[0].id).not.toBe("opp1");
    });
  });

  describe("POST /api/opps", () => {
    test("401 sem token", async () => {
      const res = await request(app)
        .post("/api/opps")
        .send({ clientId: "client1", saleType: "PROJETO" });

      expect(res.status).toBe(401);
    });

    test("400 se faltar clientId ou saleType", async () => {
      const missingClient = await request(app)
        .post("/api/opps")
        .set("Authorization", auth())
        .send({ saleType: "PROJETO" });
      const missingSaleType = await request(app)
        .post("/api/opps")
        .set("Authorization", auth())
        .send({ clientId: "client1" });

      expect(missingClient.status).toBe(400);
      expect(missingSaleType.status).toBe(400);
    });

    test("400 se saleType inválido", async () => {
      const res = await request(app)
        .post("/api/opps")
        .set("Authorization", auth())
        .send({ clientId: "client1", saleType: "INVALIDO" });

      expect(res.status).toBe(400);
    });

    test("404 se cliente não existe", async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/opps")
        .set("Authorization", auth())
        .send({ clientId: "client1", saleType: "PROJETO" });

      expect(res.status).toBe(404);
    });

    test("201 com oportunidade criada", async () => {
      const created = { id: "opp-created" };
      const detail = oppFixture({ id: "opp-created", oppNo: "O00009" });
      const tx = transactionPrisma(created, detail);
      prisma.client.findFirst.mockResolvedValue({ id: "client1" });
      prisma.user.findFirst.mockResolvedValue({ id: "seller2" });
      prisma.opportunity.count.mockResolvedValue(8);
      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      const res = await request(app)
        .post("/api/opps")
        .set("Authorization", auth())
        .send({
          clientId: "client1",
          saleType: "PROJETO",
          sellerUserId: "seller2",
          estServices: 100,
          estCostPrice: 50
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({
        id: "opp-created",
        oppNo: "O00009",
        estServices: 100,
        estSellPrice: 185
      }));
      expect(tx.opportunity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company1",
          oppNo: "O00009",
          clientId: "client1",
          sellerUserId: "seller2",
          saleType: "PROJETO",
          status: "ABERTA",
          estServices: 100,
          estCostPrice: 50
        })
      });
      expect(tx.opportunityStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oppId: "opp-created",
          fromStatus: null,
          toStatus: "ABERTA"
        })
      });
    });
  });

  describe("GET /api/opps/:id", () => {
    test("401 sem token", async () => {
      const res = await request(app).get("/api/opps/opp1");

      expect(res.status).toBe(401);
    });

    test("404 se não existe", async () => {
      prisma.opportunity.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/opps/opp1")
        .set("Authorization", auth());

      expect(res.status).toBe(404);
    });

    test("200 com detalhe serializado", async () => {
      prisma.opportunity.findFirst.mockResolvedValue(oppFixture({
        finalServices: "200.00",
        finalSoftware: "50.00",
        realCostPrice: "90.00"
      }));

      const res = await request(app)
        .get("/api/opps/opp1")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        id: "opp1",
        estServices: 100,
        finalServices: 200,
        realCostPrice: 90,
        estSellPrice: 185,
        finalSellPrice: 250,
        finalMargin: 160
      }));
    });
  });

  describe("POST /api/opps/:id/status", () => {
    test("401 sem token", async () => {
      const res = await request(app)
        .post("/api/opps/opp1/status")
        .send({ toStatus: "NEGOCIACAO" });

      expect(res.status).toBe(401);
    });

    test("400 se toStatus em falta", async () => {
      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({});

      expect(res.status).toBe(400);
    });

    test("400 se PERDIDA sem lossReason", async () => {
      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "PERDIDA" });

      expect(res.status).toBe(400);
    });

    test("404 se opp não existe", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1" });
      transitionStatus.mockRejectedValue(new Error("not_found"));

      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "NEGOCIACAO" });

      expect(res.status).toBe(404);
    });

    test("422 se tentar GANHA manual", async () => {
      transitionStatus.mockRejectedValue(new Error("invalid_transition"));

      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "GANHA" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("ganha_requer_adjudicacao");
      expect(transitionStatus).not.toHaveBeenCalled();
    });

    test("422 se transição inválida", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1" });
      transitionStatus.mockRejectedValue(new Error("invalid_transition"));

      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "ABERTA" });

      expect(res.status).toBe(422);
    });

    test("200 com oportunidade actualizada", async () => {
      prisma.opportunity.findFirst
        .mockResolvedValueOnce({ id: "opp1" })
        .mockResolvedValueOnce(oppFixture({
          status: "NEGOCIACAO"
        }));
      transitionStatus.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "NEGOCIACAO", note: "Avançar" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("NEGOCIACAO");
      expect(transitionStatus).toHaveBeenCalledWith(
        prisma,
        "opp1",
        "NEGOCIACAO",
        "admin1",
        "Admin",
        "Avançar",
        undefined,
        "company1"
      );
    });
  });

  describe("attachments e adjudicação", () => {
    test("upload PROPOSTA substitui a anterior e remove ficheiro antigo", async () => {
      const tx = transactionPrisma({ id: "opp1" }, oppFixture());
      tx.attachment.findMany.mockResolvedValue([
        { id: "old-att", path: "/tmp/old-proposal.pdf" }
      ]);
      tx.attachment.deleteMany.mockResolvedValue({ count: 1 });
      tx.attachment.create.mockResolvedValue({
        id: "new-att",
        type: "PROPOSTA",
        filename: "new-proposal.pdf",
        adjudicada: false,
        uploadedAt: "2026-06-26T10:00:00.000Z"
      });
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1", status: "NEGOCIACAO" });
      prisma.$transaction.mockImplementationOnce(async (callback) => callback(tx));

      const res = await request(app)
        .post("/api/opps/opp1/attachments")
        .set("Authorization", auth())
        .field("type", "PROPOSTA")
        .attach("file", Buffer.from("%PDF-1.4\n"), {
          filename: "new-proposal.pdf",
          contentType: "application/pdf"
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({
        id: "new-att",
        type: "PROPOSTA",
        adjudicada: false
      }));
      expect(tx.attachment.deleteMany).toHaveBeenCalledWith({
        where: {
          oppId: "opp1",
          type: "PROPOSTA"
        }
      });
      expect(tx.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oppId: "opp1",
          type: "PROPOSTA",
          filename: "new-proposal.pdf",
          adjudicada: false
        }),
        select: expect.any(Object)
      });
      expect(fs.unlink).toHaveBeenCalledWith("/tmp/old-proposal.pdf");
    });

    test("upload PROPOSTA bloqueia se oportunidade já está GANHA", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1", status: "GANHA" });

      const res = await request(app)
        .post("/api/opps/opp1/attachments")
        .set("Authorization", auth())
        .field("type", "PROPOSTA")
        .attach("file", Buffer.from("%PDF-1.4\n"), {
          filename: "proposal.pdf",
          contentType: "application/pdf"
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("desadjudique antes de substituir a proposta");
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining("/tmp/"));
    });

    test("adjudicar grava venda final, billingStartDate, attachment e histórico", async () => {
      const detail = oppFixture({
        status: "GANHA",
        finalServices: "120.00",
        finalSoftware: "60.00",
        finalHardware: "30.00",
        finalMaintenance: "15.00",
        billingStartDate: "2026-07-15T00:00:00.000Z",
        attachments: [
          {
            id: "att1",
            type: "PROPOSTA",
            filename: "proposal.pdf",
            adjudicada: true,
            uploadedAt: "2026-06-26T10:00:00.000Z"
          }
        ],
        statusHistory: [
          {
            id: "hist1",
            fromStatus: "NEGOCIACAO",
            toStatus: "GANHA",
            note: "Proposta adjudicada: proposal.pdf",
            changedBy: "Admin",
            createdAt: "2026-06-26T10:00:00.000Z"
          }
        ]
      });
      const tx = transactionPrisma({ id: "opp1" }, detail);
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1", status: "NEGOCIACAO" });
      prisma.attachment.findFirst.mockResolvedValueOnce({
        id: "att1",
        type: "PROPOSTA",
        filename: "proposal.pdf"
      });
      prisma.$transaction.mockImplementationOnce(async (callback) => callback(tx));

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/adjudicar")
        .set("Authorization", auth())
        .send({
          finalServices: 120,
          finalSoftware: 60,
          finalHardware: 30,
          finalMaintenance: 15,
          billingStartDate: "2026-07-15"
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        status: "GANHA",
        finalServices: 120,
        finalSoftware: 60,
        finalHardware: 30,
        finalMaintenance: 15,
        finalSellPrice: 225
      }));
      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: expect.objectContaining({
          finalServices: 120,
          finalSoftware: 60,
          finalHardware: 30,
          finalMaintenance: 15,
          billingStartDate: expect.any(Date),
          status: "GANHA",
          archived: false,
          lossReason: null
        })
      });
      expect(tx.attachment.updateMany).toHaveBeenCalledWith({
        where: {
          oppId: "opp1",
          type: "PROPOSTA",
          id: { not: "att1" }
        },
        data: { adjudicada: false }
      });
      expect(tx.attachment.update).toHaveBeenCalledWith({
        where: { id: "att1" },
        data: { adjudicada: true }
      });
      expect(tx.opportunityStatusHistory.create).toHaveBeenCalledWith({
        data: {
          oppId: "opp1",
          fromStatus: "NEGOCIACAO",
          toStatus: "GANHA",
          note: "Proposta adjudicada: proposal.pdf",
          changedBy: "Admin"
        }
      });
    });

    test("adjudicar é só ADMIN", async () => {
      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/adjudicar")
        .set("Authorization", auth(vendorToken))
        .send({
          finalServices: 120,
          finalSoftware: 60,
          finalHardware: 30,
          finalMaintenance: 15,
          billingStartDate: "2026-07-15"
        });

      expect(res.status).toBe(403);
    });

    test("adjudicar bloqueia valores finais negativos", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1", status: "NEGOCIACAO" });
      prisma.attachment.findFirst.mockResolvedValueOnce({
        id: "att1",
        type: "PROPOSTA",
        filename: "proposal.pdf"
      });

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/adjudicar")
        .set("Authorization", auth())
        .send({
          finalServices: -1,
          finalSoftware: 60,
          finalHardware: 30,
          finalMaintenance: 15,
          billingStartDate: "2026-07-15"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("valores finais inválidos");
    });

    test("adjudicar bloqueia data em falta ou inválida", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1", status: "NEGOCIACAO" });
      prisma.attachment.findFirst.mockResolvedValueOnce({
        id: "att1",
        type: "PROPOSTA",
        filename: "proposal.pdf"
      });

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/adjudicar")
        .set("Authorization", auth())
        .send({
          finalServices: 120,
          finalSoftware: 60,
          finalHardware: 30,
          finalMaintenance: 15,
          billingStartDate: ""
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("billingStartDate inválida");
    });

    test("desadjudicar volta a NEGOCIACAO e mantém valores finais", async () => {
      const detail = oppFixture({
        status: "NEGOCIACAO",
        finalServices: "120.00",
        finalSoftware: "60.00",
        finalHardware: "30.00",
        finalMaintenance: "15.00",
        billingStartDate: "2026-07-15T00:00:00.000Z",
        attachments: [
          {
            id: "att1",
            type: "PROPOSTA",
            filename: "proposal.pdf",
            adjudicada: false,
            uploadedAt: "2026-06-26T10:00:00.000Z"
          }
        ]
      });
      const tx = transactionPrisma({ id: "opp1" }, detail);
      prisma.opportunity.findFirst.mockResolvedValueOnce({
        id: "opp1",
        status: "GANHA",
        realCostPrice: "0.00"
      });
      prisma.attachment.findFirst
        .mockResolvedValueOnce({
          id: "att1",
          type: "PROPOSTA",
          adjudicada: true
        })
        .mockResolvedValueOnce(null);
      prisma.$transaction.mockImplementationOnce(async (callback) => callback(tx));

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/desadjudicar")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        status: "NEGOCIACAO",
        finalServices: 120,
        finalSellPrice: 225
      }));
      expect(tx.attachment.update).toHaveBeenCalledWith({
        where: { id: "att1" },
        data: { adjudicada: false }
      });
      expect(tx.opportunity.update).toHaveBeenCalledWith({
        where: { id: "opp1" },
        data: {
          status: "NEGOCIACAO",
          archived: false,
          lossReason: null
        }
      });
      expect(tx.opportunityStatusHistory.create).toHaveBeenCalledWith({
        data: {
          oppId: "opp1",
          fromStatus: "GANHA",
          toStatus: "NEGOCIACAO",
          note: "Adjudicação revertida",
          changedBy: "Admin"
        }
      });
    });

    test("desadjudicar bloqueia se já existe custo real", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({
        id: "opp1",
        status: "GANHA",
        realCostPrice: "1.00"
      });
      prisma.attachment.findFirst.mockResolvedValueOnce({
        id: "att1",
        type: "PROPOSTA",
        adjudicada: true
      });

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/desadjudicar")
        .set("Authorization", auth());

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("desadjudicacao_bloqueada_por_custo_real");
    });

    test("desadjudicar bloqueia se já existem COMPRA/FATURA", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({
        id: "opp1",
        status: "GANHA",
        realCostPrice: "0.00"
      });
      prisma.attachment.findFirst
        .mockResolvedValueOnce({
          id: "att1",
          type: "PROPOSTA",
          adjudicada: true
        })
        .mockResolvedValueOnce({ id: "invoice1" });

      const res = await request(app)
        .patch("/api/opps/opp1/attachments/att1/desadjudicar")
        .set("Authorization", auth());

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("desadjudicacao_bloqueada_por_documentos");
    });
  });

  describe("GET /api/dashboard", () => {
    test("401 sem token", async () => {
      const res = await request(app).get("/api/dashboard");

      expect(res.status).toBe(401);
    });

    test("403 se VENDEDOR", async () => {
      const res = await request(app)
        .get("/api/dashboard")
        .set("Authorization", auth(vendorToken));

      expect(res.status).toBe(403);
    });

    test("200 com contrato de agregação", async () => {
      prisma.opportunity.findMany
        .mockResolvedValueOnce([
          oppFixture({
            status: "ABERTA",
            estServices: "100.00",
            estSoftware: "0.00",
            estHardware: "0.00",
            estMaintenance: "0.00"
          })
        ])
        .mockResolvedValueOnce([
          oppFixture({
            status: "GANHA",
            finalServices: "200.00",
            finalSoftware: "0.00",
            finalHardware: "0.00",
            finalMaintenance: "0.00",
            realCostPrice: "50.00"
          })
        ])
        .mockResolvedValueOnce([
          oppFixture({ status: "PERDIDA" })
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          oppFixture({
            status: "ABERTA",
            estServices: "100.00",
            estSoftware: "0.00",
            estHardware: "0.00",
            estMaintenance: "0.00"
          }),
          oppFixture({
            status: "GANHA",
            finalServices: "200.00",
            finalSoftware: "0.00",
            finalHardware: "0.00",
            finalMaintenance: "0.00",
            realCostPrice: "50.00"
          }),
          oppFixture({ status: "PERDIDA" })
        ])
        .mockResolvedValueOnce([
          oppFixture({
            status: "ABERTA",
            saleType: "PROJETO",
            estServices: "100.00",
            estSoftware: "0.00",
            estHardware: "0.00",
            estMaintenance: "0.00"
          }),
          oppFixture({
            status: "GANHA",
            saleType: "PROJETO",
            finalServices: "200.00",
            finalSoftware: "0.00",
            finalHardware: "0.00",
            finalMaintenance: "0.00",
            realCostPrice: "50.00"
          })
        ]);

      const res = await request(app)
        .get("/api/dashboard")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        period: expect.any(String),
        pipeline_total: 100,
        pipeline_count: 1,
        won_revenue: 200,
        won_count: 1,
        won_margin: 150,
        won_margin_pct: 75,
        lost_count: 1,
        win_rate: 50
      }));
      expect(res.body.forecast).toEqual(expect.objectContaining({
        next_30: 0,
        next_60: 0,
        next_90: 0
      }));
      expect(res.body.by_seller[0]).toEqual(expect.objectContaining({
        seller_id: "seller1",
        pipeline_total: 100,
        won_revenue: 200,
        won_margin: 150,
        win_rate: 50
      }));
      expect(res.body.by_type[0]).toEqual(expect.objectContaining({
        sale_type: "PROJETO",
        pipeline_total: 100,
        won_revenue: 200
      }));
    });
  });
});
