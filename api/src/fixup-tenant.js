require("dotenv/config");

const prisma = require("./prisma");

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: "n4a" },
    select: { id: true, name: true, slug: true }
  });

  if (!company) {
    throw new Error('Company com slug "n4a" não encontrada');
  }

  const [users, clients, opportunities] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { companyId: null },
      data: { companyId: company.id }
    }),
    prisma.client.updateMany({
      where: { companyId: null },
      data: { companyId: company.id }
    }),
    prisma.opportunity.updateMany({
      where: { companyId: null },
      data: { companyId: company.id }
    })
  ]);

  console.log(`Tenant N4A: ${company.name} (${company.id})`);
  console.log(`users actualizados: ${users.count}`);
  console.log(`clients actualizados: ${clients.count}`);
  console.log(`opportunities actualizadas: ${opportunities.count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
