const prisma = require("./prisma");
const { checkPassword, signToken } = require("./auth");

async function authRouter(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email e password são obrigatórios" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const passwordOk = await checkPassword(password, user.passwordHash);

    if (!passwordOk) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = signToken({ sub: user.id, role: user.role, name: user.name });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = authRouter;
