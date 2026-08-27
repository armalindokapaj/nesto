-- AlterTable
ALTER TABLE "Calculation" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "DocumentFile" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Drawing" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "DrawingRevision" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "ProjectPhoto" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "ProjectRender" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Specification" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Submittal" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "UnitRender" ADD COLUMN     "fileUrl" TEXT;
