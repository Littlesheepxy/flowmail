-- CreateTable
CREATE TABLE "entity_view" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'LayoutDashboardIcon',
    "spec" TEXT NOT NULL DEFAULT '{"blocks":[]}',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_view_organizationId_idx" ON "entity_view"("organizationId");

-- CreateIndex
CREATE INDEX "entity_view_entityId_idx" ON "entity_view"("entityId");

-- CreateIndex
CREATE INDEX "entity_view_categoryId_idx" ON "entity_view"("categoryId");

-- AddForeignKey
ALTER TABLE "entity_view" ADD CONSTRAINT "entity_view_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_view" ADD CONSTRAINT "entity_view_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "flow_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_view" ADD CONSTRAINT "entity_view_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_view" ADD CONSTRAINT "entity_view_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
