process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.PORT = "18080";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = "/tmp";

const request = require("supertest");

jest.mock("../src/prisma", () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  client: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  opportunity: {
    findMany: jest.fn()
  }
}));

const prisma = require("../src/prisma");
const app = require("../src/index");
const { signToken } = require("../src/auth");

const adminToken = signToken({
  sub: "admin1",
  name: "Admin",
  email: "admin@n4a.pt",
  role: "ADMIN"
});

const vendorToken = signToken({
  sub: "seller1",
  name: "Vendedor",
  email: "seller@n4a.pt",
  role: "VENDEDOR"
});

function auth(token = adminToken) {
  return `Bearer ${token}`;
}

function clientFixture(overrides = {}) {
  return {
    id: "client1",
    clientNo: "C0001",
    name: "Cliente A",
    nif: "500000001",
    responsibleName: "Maria Cliente",
    email: "maria@example.test",
    phone: "210000001",
    address: "Rua A",
    description: "Cliente de teste",
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides
  };
}

function p2025() {
  const err = new Error("Not found");
  err.code = "P2025";
  return err;
}

describe("routes clients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.client.count.mockResolvedValue(0);
    prisma.client.findFirst.mockResolvedValue(null);
  });

  describe("GET /api/clients", () => {
    test("401 sem token", async () => {
      const res = await request(app).get("/api/clients");

      expect(res.status).toBe(401);
    });

    test("200 com lista de clientes", async () => {
      const client = clientFixture();
      prisma.client.findMany.mockResolvedValue([client]);

      const res = await request(app)
        .get("/api/clients")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body).toEqual([client]);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({ id: true, name: true }),
        orderBy: { clientNo: "asc" }
      });
    });

    test("VENDEDOR recebe 200", async () => {
      prisma.client.findMany.mockResolvedValue([clientFixture()]);

      const res = await request(app)
        .get("/api/clients")
        .set("Authorization", auth(vendorToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("POST /api/clients", () => {
    const validBody = {
      name: "Novo Cliente",
      nif: "500000002",
      responsibleName: "João Novo",
      email: "joao@example.test",
      phone: "210000002",
      address: "Rua Nova",
      description: "Descrição"
    };

    test("401 sem token", async () => {
      const res = await request(app)
        .post("/api/clients")
        .send(validBody);

      expect(res.status).toBe(401);
    });

    test("400 se faltar campo obrigatório", async () => {
      const requiredFields = ["name", "nif", "responsibleName", "email", "phone"];

      for (const field of requiredFields) {
        const body = { ...validBody };
        delete body[field];

        const res = await request(app)
          .post("/api/clients")
          .set("Authorization", auth())
          .send(body);

        expect(res.status).toBe(400);
      }
    });

    test("409 se NIF já existe", async () => {
      prisma.client.findFirst.mockResolvedValue({ id: "client-existing" });

      const res = await request(app)
        .post("/api/clients")
        .set("Authorization", auth())
        .send(validBody);

      expect(res.status).toBe(409);
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    test("201 com cliente criado", async () => {
      const created = clientFixture({ id: "client2", clientNo: "C0001", ...validBody });
      prisma.client.count.mockResolvedValue(0);
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(created);

      const res = await request(app)
        .post("/api/clients")
        .set("Authorization", auth())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          clientNo: "C0001",
          ...validBody
        },
        select: expect.objectContaining({ address: true, description: true })
      });
    });

    test("VENDEDOR pode criar", async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(clientFixture({ id: "client2", ...validBody }));

      const res = await request(app)
        .post("/api/clients")
        .set("Authorization", auth(vendorToken))
        .send(validBody);

      expect(res.status).toBe(201);
      expect(prisma.client.create).toHaveBeenCalled();
    });
  });

  describe("PATCH /api/clients/:id", () => {
    test("401 sem token", async () => {
      const res = await request(app)
        .patch("/api/clients/client1")
        .send({ name: "Cliente Editado" });

      expect(res.status).toBe(401);
    });

    test("403 se VENDEDOR", async () => {
      const res = await request(app)
        .patch("/api/clients/client1")
        .set("Authorization", auth(vendorToken))
        .send({ name: "Cliente Editado" });

      expect(res.status).toBe(403);
    });

    test("404 se cliente não existe", async () => {
      prisma.client.update.mockRejectedValue(p2025());

      const res = await request(app)
        .patch("/api/clients/client1")
        .set("Authorization", auth())
        .send({ name: "Cliente Editado" });

      expect(res.status).toBe(404);
    });

    test("200 com cliente actualizado", async () => {
      const updated = clientFixture({ name: "Cliente Editado" });
      prisma.client.update.mockResolvedValue(updated);

      const res = await request(app)
        .patch("/api/clients/client1")
        .set("Authorization", auth())
        .send({ name: "Cliente Editado" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: "client1" },
        data: { name: "Cliente Editado" },
        select: expect.objectContaining({ address: true, description: true })
      });
    });
  });

  describe("GET /api/clients/:id", () => {
    test("401 sem token", async () => {
      const res = await request(app).get("/api/clients/client1");

      expect(res.status).toBe(401);
    });

    test("404 se não existe", async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/clients/client1")
        .set("Authorization", auth());

      expect(res.status).toBe(404);
    });

    test("200 com cliente e oportunidades", async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...clientFixture(),
        opportunities: [
          {
            id: "opp1",
            oppNo: "O00001",
            status: "ABERTA",
            saleType: "PROJETO",
            estServices: "100.00",
            estSoftware: "50.00",
            estHardware: "25.00",
            estMaintenance: "10.00",
            estCostPrice: "80.00",
            expectedCloseDate: "2026-07-01T10:00:00.000Z",
            createdAt: "2026-06-22T10:00:00.000Z",
            seller: {
              id: "seller1",
              name: "Vendedor"
            }
          }
        ]
      });

      const res = await request(app)
        .get("/api/clients/client1")
        .set("Authorization", auth());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("client1");
      expect(res.body.opportunities).toHaveLength(1);
      expect(res.body.opportunities[0]).toEqual(expect.objectContaining({
        id: "opp1",
        estServices: 100,
        estSellPrice: 185,
        estGrossMargin: 105,
        seller: { id: "seller1", name: "Vendedor" }
      }));
    });
  });
});
