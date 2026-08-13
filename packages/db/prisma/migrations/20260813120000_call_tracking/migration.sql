-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('ATTENDED', 'REJECTED', 'TRAINED', 'FRONT_DESK', 'OWNER_TALK');

-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "callId" TEXT;

-- CreateTable
CREATE TABLE "call" (
    "id" TEXT NOT NULL,
    "twilioCallSid" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationSec" INTEGER,
    "recordingUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "outcome" "CallOutcome",
    "note" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "classifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_twilioCallSid_key" ON "call"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_outcome_idx" ON "call"("outcome");

-- CreateIndex
CREATE INDEX "call_createdAt_idx" ON "call"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_callId_key" ON "activity"("callId");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_callId_fkey" FOREIGN KEY ("callId") REFERENCES "call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call" ADD CONSTRAINT "call_classifiedById_fkey" FOREIGN KEY ("classifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
