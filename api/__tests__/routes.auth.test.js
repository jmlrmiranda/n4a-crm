process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.PORT = "18080";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = "/tmp";

const request = require("supertest");

jest.mock("../src/prisma", () => ({
  user: {
    findUnique: jest.fn()
  }
}));

const prisma = require("../src/prisma");
const app = require("../src/index");
const { hashPassword } = require("../src/auth");

describe("POST /auth/login", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

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
      isActive: false
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
      isActive: true
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
      isActive: true
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
      role: "ADMIN"
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });
});
