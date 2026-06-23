process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.PORT = "18080";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = "/tmp";

const request = require("supertest");

jest.mock("../src/prisma", () => ({
  company: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  }
}));

const prisma = require("../src/prisma");
const app = require("../src/index");
const { hashPassword, signToken, verifyToken } = require("../src/auth");

describe("POST /auth/login", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.company.findUnique.mockReset();
    prisma.company.findMany.mockReset();
  });

  function companyFixture(overrides = {}) {
    return {
      id: "company1",
      name: "N4A",
      slug: "n4a",
      isActive: true,
      ...overrides
    };
  }

  test("400 quando body vazio", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({});

    expect(res.status).toBe(400);
  });

  test("400 quando falta email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ password: "secret" });

    expect(res.status).toBe(400);
  });

  test("400 quando falta password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt" });

    expect(res.status).toBe(400);
  });

  test("401 quando utilizador não existe", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt", password: "secret" });

    expect(res.status).toBe(401);
  });

  test("401 quando utilizador inactivo", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user1",
      name: "Admin",
      email: "admin@n4a.pt",
      passwordHash: "hash",
      role: "ADMIN",
      isActive: false,
      companyId: "company1"
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt", password: "secret" });

    expect(res.status).toBe(401);
  });

  test("401 quando password errada", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user1",
      name: "Admin",
      email: "admin@n4a.pt",
      passwordHash: await hashPassword("correct-password"),
      role: "ADMIN",
      isActive: true,
      companyId: "company1",
      company: companyFixture()
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  test("200 com token e user quando credenciais correctas", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user1",
      name: "Admin",
      email: "admin@n4a.pt",
      passwordHash: await hashPassword("correct-password"),
      role: "ADMIN",
      isActive: true,
      companyId: "company1",
      company: companyFixture()
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: "user1",
      name: "Admin",
      email: "admin@n4a.pt",
      role: "ADMIN",
      companyId: "company1"
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
    expect(verifyToken(res.body.token).companyId).toBe("company1");
  });

  test("401 quando company está inactiva", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user1",
      name: "Admin",
      email: "admin@n4a.pt",
      passwordHash: await hashPassword("correct-password"),
      role: "ADMIN",
      isActive: true,
      companyId: "company1",
      company: { isActive: false }
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@n4a.pt", password: "correct-password" });

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/switch-company", () => {
  const adminToken = signToken({
    sub: "admin1",
    name: "Admin",
    role: "ADMIN",
    companyId: "company1"
  });

  const supportToken = signToken({
    sub: "support1",
    name: "Support",
    role: "N4A_SUPPORT",
    companyId: "company1"
  });

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.company.findUnique.mockReset();
    prisma.company.findMany.mockReset();
  });

  test("403 se não for N4A_SUPPORT", async () => {
    const res = await request(app)
      .post("/auth/switch-company")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ targetCompanyId: "company2" });

    expect(res.status).toBe(403);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  test("400 sem targetCompanyId", async () => {
    const res = await request(app)
      .post("/auth/switch-company")
      .set("Authorization", `Bearer ${supportToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test("200 com novo token para company activa", async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: "company2",
      name: "Cliente Demo",
      slug: "cliente-demo",
      isActive: true
    });

    const res = await request(app)
      .post("/auth/switch-company")
      .set("Authorization", `Bearer ${supportToken}`)
      .send({ targetCompanyId: "company2" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.company).toEqual({
      id: "company2",
      name: "Cliente Demo",
      slug: "cliente-demo",
      isActive: true
    });
    expect(verifyToken(res.body.token)).toEqual(expect.objectContaining({
      sub: "support1",
      role: "N4A_SUPPORT",
      companyId: "company2"
    }));
  });
});

describe("GET /admin/companies", () => {
  const adminToken = signToken({
    sub: "admin1",
    name: "Admin",
    role: "ADMIN",
    companyId: "company1"
  });

  const supportToken = signToken({
    sub: "support1",
    name: "Support",
    role: "N4A_SUPPORT",
    companyId: "company1"
  });

  const n4aAdminToken = signToken({
    sub: "n4a-admin1",
    name: "N4A Admin",
    role: "N4A_ADMIN",
    companyId: "company1"
  });

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.company.findUnique.mockReset();
    prisma.company.findMany.mockReset();
  });

  test("403 se for ADMIN normal", async () => {
    const res = await request(app)
      .get("/admin/companies")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });

  test("200 para N4A_SUPPORT", async () => {
    const companies = [
      { id: "company2", name: "Cliente Demo", slug: "cliente-demo", isActive: true },
      { id: "company1", name: "N4A", slug: "n4a", isActive: true }
    ];
    prisma.company.findMany.mockResolvedValue(companies);

    const res = await request(app)
      .get("/admin/companies")
      .set("Authorization", `Bearer ${supportToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(companies);
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true
      },
      orderBy: { name: "asc" }
    });
  });

  test("200 para N4A_ADMIN", async () => {
    prisma.company.findMany.mockResolvedValue([
      { id: "company1", name: "N4A", slug: "n4a", isActive: true }
    ]);

    const res = await request(app)
      .get("/admin/companies")
      .set("Authorization", `Bearer ${n4aAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
