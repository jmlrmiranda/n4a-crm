const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

const users = [
  {
    name: "Tiago Cerqueira",
    email: "tiago.cerqueira@n4a.pt",
    role: "ADMIN"
  },
  {
    name: "Jorge Miranda",
    email: "jorge.miranda@n4a.pt",
    role: "ADMIN"
  }
];

async function findTenant() {
  const n4a = await prisma.company.findFirst({
    where: { name: "N4A" },
    orderBy: { createdAt: "asc" }
  });

  if (n4a) {
    return n4a;
  }

  return prisma.company.findFirst({
    orderBy: { createdAt: "asc" }
  });
}

async function main() {
  const password = process.env.REAL_USERS_PASSWORD;

  if (!password) {
    throw new Error("REAL_USERS_PASSWORD é obrigatória para criar/actualizar utilizadores reais.");
  }

  const company = await findTenant();

  if (!company) {
    throw new Error("Nenhuma empresa encontrada para associar utilizadores.");
  }

  console.log(`Empresa usada: ${company.name} (${company.id})`);

  for (const user of users) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        companyId: company.id,
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true
      },
      create: {
        companyId: company.id,
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: true
      }
    });

    console.log(`Utilizador criado/actualizado: ${user.email}`);
  }

  const allUsers = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  console.table(allUsers);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
