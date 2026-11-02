-- AlterEnum
ALTER TYPE "StatutMessage" ADD VALUE 'EN_COURS';

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "erreur" TEXT;
