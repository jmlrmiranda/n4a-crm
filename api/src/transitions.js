const TRANSITIONS = {
  ABERTA: ["PROPOSTA_EM_PREPARACAO", "PERDIDA"],
  PROPOSTA_EM_PREPARACAO: ["PROPOSTA_ENVIADA", "PERDIDA"],
  PROPOSTA_ENVIADA: ["NEGOCIACAO", "GANHA", "PERDIDA"],
  NEGOCIACAO: ["GANHA", "PERDIDA"],
  GANHA: [],
  PERDIDA: []
};

function isValidTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

async function transitionStatus(prisma, oppId, toStatus, userId, userName, note, lossReason) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: oppId },
    select: {
      id: true,
      status: true,
      proposalSentDate: true
    }
  });

  if (!opportunity) {
    throw new Error("not_found");
  }

  if (!isValidTransition(opportunity.status, toStatus)) {
    throw new Error("invalid_transition");
  }

  return prisma.$transaction(async (tx) => {
    const data = { status: toStatus };

    if (toStatus === "PROPOSTA_ENVIADA" && !opportunity.proposalSentDate) {
      data.proposalSentDate = new Date();
    }

    if (toStatus === "GANHA") {
      data.archived = false;
      data.lossReason = null;
    }

    if (toStatus === "PERDIDA") {
      data.archived = true;

      if (lossReason) {
        data.lossReason = lossReason;
      }
    }

    await tx.opportunity.update({
      where: { id: oppId },
      data
    });

    await tx.opportunityStatusHistory.create({
      data: {
        oppId,
        fromStatus: opportunity.status,
        toStatus,
        note,
        changedBy: userName || userId
      }
    });

    return tx.opportunity.findUnique({
      where: { id: oppId },
      include: {
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
  });
}

module.exports = {
  isValidTransition,
  transitionStatus
};
