require("dotenv/config");

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} não definido — abortando`);
  }

  return value;
}

const CORS_ORIGIN = requireEnv("CORS_ORIGIN");
const PORT = requireEnv("PORT");
const { requireAuth, requireAdmin } = require("./middleware.auth");
const authRouter = require("./routes.auth");
const usersRouter = require("./routes.users");
const clientsRouter = require("./routes.clients");
const oppsRouter = require("./routes.opps");
const dashboardRouter = require("./routes.dashboard");

const app = express();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.post("/auth/login", loginLimiter, authRouter);

app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/clients", requireAuth, clientsRouter);
app.use("/api/opps", requireAuth, oppsRouter);
app.use("/api/dashboard", requireAuth, requireAdmin, dashboardRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`n4a-crm-api listening on port ${PORT}`);
  });
}

module.exports = app;
