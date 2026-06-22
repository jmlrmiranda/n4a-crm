require("dotenv/config");

const prisma = require("./prisma");
const { hashPassword } = require("./auth");

const users = [
  {
    name: "Miranda Admin",
    email: "admin@n4a.pt",
    password: "n4a-admin-2026",
    role: "ADMIN"
  },
  {
    name: "Ana Vendas",
    email: "ana@n4a.pt",
    password: "n4a-vendas-2026",
    role: "VENDEDOR"
  },
  {
    name: "Bruno Silva",
    email: "bruno@n4a.pt",
    password: "n4a-vendas-2026",
    role: "VENDEDOR"
  }
];

const clients = [
  {
    clientNo: "C0001",
    name: "Município de Lisboa",
    nif: "500123456",
    responsibleName: "João Ferreira",
    email: "joao.ferreira@cm-lisboa.pt",
    phone: "213000001",
    description: "Cliente institucional, projecto de digitalização"
  },
  {
    clientNo: "C0002",
    name: "Grupo Sonae SGPS",
    nif: "500273170",
    responsibleName: "Maria Santos",
    email: "m.santos@sonae.pt",
    phone: "229000002",
    description: "Parceiro estratégico, subscrição anual"
  },
  {
    clientNo: "C0003",
    name: "Universidade do Porto",
    nif: "501413197",
    responsibleName: "Carlos Oliveira",
    email: "c.oliveira@up.pt",
    phone: "225000003",
    description: "Projecto de investigação aplicada"
  },
  {
    clientNo: "C0004",
    name: "NOS Comunicações",
    nif: "502155093",
    responsibleName: "Sofia Costa",
    email: "s.costa@nos.pt",
    phone: "214000004"
  },
  {
    clientNo: "C0005",
    name: "Jerónimo Martins",
    nif: "500100144",
    responsibleName: "Pedro Alves",
    email: "p.alves@jeronimomartins.pt",
    phone: "213000005"
  }
];

const opportunities = [
  {
    oppNo: "O00001",
    clientNo: "C0001",
    sellerEmail: "ana@n4a.pt",
    saleType: "PROJETO",
    status: "GANHA",
    estServices: 45000,
    estSoftware: 8000,
    estHardware: 0,
    estMaintenance: 5000,
    estCostPrice: 22000,
    finalServices: 45000,
    finalSoftware: 8000,
    finalHardware: 0,
    finalMaintenance: 5000,
    realCostPrice: 21500,
    expectedCloseDate: "2026-03-15",
    historyStart: "2026-01-12",
    history: ["ABERTA", "PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHA"]
  },
  {
    oppNo: "O00002",
    clientNo: "C0002",
    sellerEmail: "bruno@n4a.pt",
    saleType: "SUBSCRICAO",
    status: "GANHA",
    estServices: 12000,
    estSoftware: 0,
    estHardware: 0,
    estMaintenance: 24000,
    estCostPrice: 8000,
    finalServices: 12000,
    finalSoftware: 0,
    finalHardware: 0,
    finalMaintenance: 24000,
    realCostPrice: 7800,
    expectedCloseDate: "2026-02-28",
    historyStart: "2026-01-20",
    history: ["ABERTA", "PROPOSTA_ENVIADA", "GANHA"]
  },
  {
    oppNo: "O00003",
    clientNo: "C0003",
    sellerEmail: "ana@n4a.pt",
    saleType: "PROJETO",
    status: "NEGOCIACAO",
    estServices: 80000,
    estSoftware: 15000,
    estHardware: 5000,
    estMaintenance: 12000,
    estCostPrice: 45000,
    expectedCloseDate: "2026-07-30",
    historyStart: "2026-05-05",
    history: ["ABERTA", "PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA", "NEGOCIACAO"]
  },
  {
    oppNo: "O00004",
    clientNo: "C0004",
    sellerEmail: "bruno@n4a.pt",
    saleType: "SUBSCRICAO",
    status: "PROPOSTA_ENVIADA",
    estServices: 18000,
    estSoftware: 0,
    estHardware: 0,
    estMaintenance: 36000,
    estCostPrice: 15000,
    expectedCloseDate: "2026-08-15",
    historyStart: "2026-05-18",
    history: ["ABERTA", "PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA"]
  },
  {
    oppNo: "O00005",
    clientNo: "C0005",
    sellerEmail: "ana@n4a.pt",
    saleType: "PROJETO",
    status: "PROPOSTA_EM_PREPARACAO",
    estServices: 35000,
    estSoftware: 20000,
    estHardware: 12000,
    estMaintenance: 8000,
    estCostPrice: 30000,
    expectedCloseDate: "2026-09-01",
    historyStart: "2026-06-03",
    history: ["ABERTA", "PROPOSTA_EM_PREPARACAO"]
  },
  {
    oppNo: "O00006",
    clientNo: "C0001",
    sellerEmail: "bruno@n4a.pt",
    saleType: "PROJETO",
    status: "ABERTA",
    estServices: 25000,
    estSoftware: 0,
    estHardware: 0,
    estMaintenance: 0,
    estCostPrice: 10000,
    expectedCloseDate: "2026-10-01",
    historyStart: "2026-06-10",
    history: ["ABERTA"]
  },
  {
    oppNo: "O00007",
    clientNo: "C0003",
    sellerEmail: "bruno@n4a.pt",
    saleType: "PROJETO",
    status: "PERDIDA",
    estServices: 60000,
    estSoftware: 10000,
    estHardware: 8000,
    estMaintenance: 0,
    estCostPrice: 35000,
    expectedCloseDate: "2026-04-01",
    lossReason: "Cliente optou por solução concorrente",
    historyStart: "2026-02-14",
    history: ["ABERTA", "PROPOSTA_ENVIADA", "PERDIDA"]
  },
  {
    oppNo: "O00008",
    clientNo: "C0002",
    sellerEmail: "ana@n4a.pt",
    saleType: "SUBSCRICAO",
    status: "PROPOSTA_ENVIADA",
    estServices: 9000,
    estSoftware: 0,
    estHardware: 0,
    estMaintenance: 18000,
    estCostPrice: 7000,
    expectedCloseDate: "2026-07-15",
    historyStart: "2026-06-01",
    history: ["ABERTA", "PROPOSTA_EM_PREPARACAO", "PROPOSTA_ENVIADA"]
  }
];

function date(value) {
  return new Date(`${value}T10:00:00.000Z`);
}

function addDays(base, days) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function proposalSentDate(opp) {
  const index = opp.history.indexOf("PROPOSTA_ENVIADA");

  if (index === -1) {
    return undefined;
  }

  return addDays(date(opp.historyStart), index * 7);
}

function historyRows(opp, sellerName) {
  const start = date(opp.historyStart);

  return opp.history.map((toStatus, index) => ({
    fromStatus: index === 0 ? null : opp.history[index - 1],
    toStatus,
    changedBy: sellerName,
    createdAt: addDays(start, index * 7)
  }));
}

async function upsertUsers(summary) {
  const userMap = new Map();

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true }
    });
    const passwordHash = await hashPassword(user.password);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: true
      }
    });

    if (existing) {
      summary.users.existing += 1;
    } else {
      summary.users.created += 1;
    }

    userMap.set(saved.email, saved);
  }

  return userMap;
}

async function upsertClients(summary) {
  const clientMap = new Map();

  for (const client of clients) {
    const existing = await prisma.client.findUnique({
      where: { clientNo: client.clientNo },
      select: { id: true }
    });
    const saved = await prisma.client.upsert({
      where: { clientNo: client.clientNo },
      update: client,
      create: client
    });

    if (existing) {
      summary.clients.existing += 1;
    } else {
      summary.clients.created += 1;
    }

    clientMap.set(saved.clientNo, saved);
  }

  return clientMap;
}

async function createOpportunity(opp, usersByEmail, clientsByNo) {
  const seller = usersByEmail.get(opp.sellerEmail);
  const client = clientsByNo.get(opp.clientNo);
  const sentDate = proposalSentDate(opp);

  if (!seller || !client) {
    throw new Error(`dados base em falta para ${opp.oppNo}`);
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        oppNo: opp.oppNo,
        clientId: client.id,
        sellerUserId: seller.id,
        saleType: opp.saleType,
        status: opp.status,
        archived: opp.status === "PERDIDA",
        lossReason: opp.lossReason || null,
        estServices: opp.estServices,
        estSoftware: opp.estSoftware,
        estHardware: opp.estHardware,
        estMaintenance: opp.estMaintenance,
        estCostPrice: opp.estCostPrice,
        finalServices: opp.finalServices || 0,
        finalSoftware: opp.finalSoftware || 0,
        finalHardware: opp.finalHardware || 0,
        finalMaintenance: opp.finalMaintenance || 0,
        realCostPrice: opp.realCostPrice || 0,
        expectedCloseDate: date(opp.expectedCloseDate),
        proposalSentDate: sentDate
      }
    });

    await tx.opportunityStatusHistory.createMany({
      data: historyRows(opp, seller.name).map((row) => ({
        ...row,
        oppId: created.id
      }))
    });

    return created;
  });
}

async function createOpportunities(summary, usersByEmail, clientsByNo) {
  for (const opp of opportunities) {
    const existing = await prisma.opportunity.findUnique({
      where: { oppNo: opp.oppNo },
      select: { id: true }
    });

    if (existing) {
      summary.opps.existing += 1;
      continue;
    }

    await createOpportunity(opp, usersByEmail, clientsByNo);
    summary.opps.created += 1;
  }
}

async function main() {
  const summary = {
    users: { created: 0, existing: 0 },
    clients: { created: 0, existing: 0 },
    opps: { created: 0, existing: 0 }
  };

  const usersByEmail = await upsertUsers(summary);
  const clientsByNo = await upsertClients(summary);
  await createOpportunities(summary, usersByEmail, clientsByNo);

  console.log("Seed concluído:");
  console.log(`users: ${summary.users.created} criados, ${summary.users.existing} existentes`);
  console.log(`clients: ${summary.clients.created} criados, ${summary.clients.existing} existentes`);
  console.log(`opps: ${summary.opps.created} criadas, ${summary.opps.existing} existentes`);
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
