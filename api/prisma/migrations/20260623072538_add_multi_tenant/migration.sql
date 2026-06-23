/*
  Warnings:

  - Existing CRM data is backfilled into the N4A company before companyId is made required.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'N4A_SUPPORT';
ALTER TYPE "Role" ADD VALUE 'N4A_ADMIN';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- BackfillCompany
INSERT INTO "Company" ("id", "name", "slug", "isActive")
VALUES ('company_n4a', 'N4A', 'n4a', true);

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;

-- BackfillTenant
UPDATE "Client" SET "companyId" = 'company_n4a' WHERE "companyId" IS NULL;
UPDATE "Opportunity" SET "companyId" = 'company_n4a' WHERE "companyId" IS NULL;
UPDATE "User" SET "companyId" = 'company_n4a' WHERE "companyId" IS NULL;

-- EnforceTenant
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Opportunity_companyId_idx" ON "Opportunity"("companyId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
