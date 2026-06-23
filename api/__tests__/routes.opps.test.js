process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.PORT = "18080";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = "/tmp";

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
      findUnique: jest.fn().mockResolvedValue(detail)
    },
    opportunityStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: "hist1" })
    }
  };
}

describe("routes opps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    test("422 se transição inválida", async () => {
      prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp1" });
      transitionStatus.mockRejectedValue(new Error("invalid_transition"));

      const res = await request(app)
        .post("/api/opps/opp1/status")
        .set("Authorization", auth())
        .send({ toStatus: "GANHA" });

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
