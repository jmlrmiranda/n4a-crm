require("dotenv/config");

const path = require("path");
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
const { requireTenant } = require("./middleware.tenant");
const { requireN4ASupportOrAdmin } = require("./middleware.admin");
const authRouter = require("./routes.auth");
const adminRouter = require("./routes.admin");
const usersRouter = require("./routes.users");
const clientsRouter = require("./routes.clients");
const oppsRouter = require("./routes.opps");
const dashboardRouter = require("./routes.dashboard");

const app = express();
app.set("trust proxy", 1);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/auth/login", loginLimiter);
app.use("/auth", authRouter);

app.use("/admin", requireAuth, requireN4ASupportOrAdmin, adminRouter);
app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/clients", requireAuth, requireTenant, clientsRouter);
app.use("/api/opps", requireAuth, requireTenant, oppsRouter);
app.use("/api/dashboard", requireAuth, requireAdmin, requireTenant, dashboardRouter);

app.get(/.*/, (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/auth") ||
    req.path.startsWith("/admin") ||
    req.path === "/health"
  ) {
    return next();
  }

  return res.sendFile(path.join(__dirname, "../public/index.html"));
});

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
