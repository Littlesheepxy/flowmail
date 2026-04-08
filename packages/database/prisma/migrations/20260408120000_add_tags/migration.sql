-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('AI', 'USER');

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "source" "TagSource" NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_tag" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "entity_tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tag_organizationId_idx" ON "tag"("organizationId");
CREATE UNIQUE INDEX "tag_organizationId_name_key" ON "tag"("organizationId", "name");

-- CreateIndex
CREATE INDEX "entity_tag_entityId_idx" ON "entity_tag"("entityId");
CREATE INDEX "entity_tag_tagId_idx" ON "entity_tag"("tagId");
CREATE UNIQUE INDEX "entity_tag_entityId_tagId_key" ON "entity_tag"("entityId", "tagId");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tag" ADD CONSTRAINT "entity_tag_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "flow_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tag" ADD CONSTRAINT "entity_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
