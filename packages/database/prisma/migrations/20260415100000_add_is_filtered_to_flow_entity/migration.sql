-- AlterTable
ALTER TABLE "flow_entity" ADD COLUMN "isFiltered" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "flow_entity_organizationId_isFiltered_idx" ON "flow_entity"("organizationId", "isFiltered");
