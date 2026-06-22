-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('PROJETO', 'SUBSCRICAO');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ABERTA', 'PROPOSTA_EM_PREPARACAO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'GANHA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PROPOSTA', 'COMPRA', 'FATURA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "clientNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "nif" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "oppNo" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "saleType" "SaleType" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ABERTA',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "lossReason" TEXT,
    "estServices" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estSoftware" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estHardware" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estMaintenance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalServices" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalSoftware" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalHardware" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalMaintenance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estCostPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "realCostPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "billingStartDate" TIMESTAMP(3),
    "proposalSentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityStatusHistory" (
    "id" TEXT NOT NULL,
    "oppId" TEXT NOT NULL,
    "fromStatus" "OpportunityStatus",
    "toStatus" "OpportunityStatus" NOT NULL,
    "note" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "oppId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "adjudicada" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "oppId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientNo_key" ON "Client"("clientNo");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Client_nif_idx" ON "Client"("nif");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_oppNo_key" ON "Opportunity"("oppNo");

-- CreateIndex
CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");

-- CreateIndex
CREATE INDEX "Opportunity_sellerUserId_idx" ON "Opportunity"("sellerUserId");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE INDEX "Opportunity_archived_idx" ON "Opportunity"("archived");

-- CreateIndex
CREATE INDEX "Opportunity_updatedAt_idx" ON "Opportunity"("updatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_expectedCloseDate_idx" ON "Opportunity"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "OpportunityStatusHistory_oppId_idx" ON "OpportunityStatusHistory"("oppId");

-- CreateIndex
CREATE INDEX "OpportunityStatusHistory_createdAt_idx" ON "OpportunityStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "OpportunityStatusHistory_toStatus_idx" ON "OpportunityStatusHistory"("toStatus");

-- CreateIndex
CREATE INDEX "Attachment_oppId_idx" ON "Attachment"("oppId");

-- CreateIndex
CREATE INDEX "Attachment_oppId_type_idx" ON "Attachment"("oppId", "type");

-- CreateIndex
CREATE INDEX "Contact_oppId_idx" ON "Contact"("oppId");

-- CreateIndex
CREATE INDEX "Contact_date_idx" ON "Contact"("date");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStatusHistory" ADD CONSTRAINT "OpportunityStatusHistory_oppId_fkey" FOREIGN KEY ("oppId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_oppId_fkey" FOREIGN KEY ("oppId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_oppId_fkey" FOREIGN KEY ("oppId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
