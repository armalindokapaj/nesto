/*
  Warnings:

  - You are about to drop the column `fileDataUrl` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `DocumentFile` table. All the data in the column will be lost.
  - You are about to drop the column `fileDataUrl` on the `Drawing` table. All the data in the column will be lost.
  - You are about to drop the column `fileDataUrl` on the `DrawingRevision` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `ProjectPhoto` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `ProjectRender` table. All the data in the column will be lost.
  - You are about to drop the column `fileDataUrl` on the `Specification` table. All the data in the column will be lost.
  - You are about to drop the column `fileDataUrl` on the `Submittal` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `UnitRender` table. All the data in the column will be lost.
  - Made the column `fileUrl` on table `ProjectPhoto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fileUrl` on table `ProjectRender` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fileUrl` on table `UnitRender` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Calculation" DROP COLUMN "fileDataUrl";

-- AlterTable
ALTER TABLE "DocumentFile" DROP COLUMN "fileData";

-- AlterTable
ALTER TABLE "Drawing" DROP COLUMN "fileDataUrl";

-- AlterTable
ALTER TABLE "DrawingRevision" DROP COLUMN "fileDataUrl";

-- AlterTable
ALTER TABLE "ProjectPhoto" DROP COLUMN "fileData",
ALTER COLUMN "fileUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProjectRender" DROP COLUMN "fileData",
ALTER COLUMN "fileUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "Specification" DROP COLUMN "fileDataUrl";

-- AlterTable
ALTER TABLE "Submittal" DROP COLUMN "fileDataUrl";

-- AlterTable
ALTER TABLE "UnitRender" DROP COLUMN "fileData",
ALTER COLUMN "fileUrl" SET NOT NULL;
