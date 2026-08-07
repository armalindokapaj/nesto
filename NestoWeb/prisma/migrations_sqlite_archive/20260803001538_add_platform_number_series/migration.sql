-- CreateTable
CREATE TABLE "PlatformNumberSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformNumberSeries_entityType_key" ON "PlatformNumberSeries"("entityType");
