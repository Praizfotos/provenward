-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('Info', 'Warning', 'Critical');

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" SERIAL NOT NULL,
    "onChainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "manufacturerId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "serialRangeStart" BIGINT NOT NULL,
    "serialRangeEnd" BIGINT NOT NULL,
    "manufacturedDate" TIMESTAMP(3) NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalls" (
    "id" SERIAL NOT NULL,
    "recallId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "manufacturerAddress" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "messageHash" TEXT NOT NULL,
    "affectedSerialStart" BIGINT NOT NULL,
    "affectedSerialEnd" BIGINT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_receipts" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNumber" BIGINT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_preferences" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "email" TEXT,
    "webhookUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_scans" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNumber" BIGINT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recall_alerts" (
    "id" SERIAL NOT NULL,
    "recallId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recall_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_cursors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_onChainId_key" ON "manufacturers"("onChainId");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_address_key" ON "manufacturers"("address");

-- CreateIndex
CREATE UNIQUE INDEX "batches_batchId_key" ON "batches"("batchId");

-- CreateIndex
CREATE INDEX "batches_manufacturerId_idx" ON "batches"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "recalls_recallId_key" ON "recalls"("recallId");

-- CreateIndex
CREATE INDEX "recalls_batchId_idx" ON "recalls"("batchId");

-- CreateIndex
CREATE INDEX "recalls_severity_idx" ON "recalls"("severity");

-- CreateIndex
CREATE INDEX "ownership_receipts_batchId_idx" ON "ownership_receipts"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_receipts_owner_batchId_serialNumber_key" ON "ownership_receipts"("owner", "batchId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "alert_preferences_owner_key" ON "alert_preferences"("owner");

-- CreateIndex
CREATE INDEX "verification_scans_batchId_idx" ON "verification_scans"("batchId");

-- CreateIndex
CREATE INDEX "verification_scans_createdAt_idx" ON "verification_scans"("createdAt");

-- CreateIndex
CREATE INDEX "recall_alerts_status_idx" ON "recall_alerts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "recall_alerts_recallId_owner_key" ON "recall_alerts"("recallId", "owner");

-- CreateIndex
CREATE UNIQUE INDEX "indexer_cursors_name_key" ON "indexer_cursors"("name");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("onChainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalls" ADD CONSTRAINT "recalls_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("batchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recall_alerts" ADD CONSTRAINT "recall_alerts_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "recalls"("recallId") ON DELETE RESTRICT ON UPDATE CASCADE;

