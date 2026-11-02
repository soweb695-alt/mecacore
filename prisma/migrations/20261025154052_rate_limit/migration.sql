-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "cle" TEXT NOT NULL,
    "compte" INTEGER NOT NULL DEFAULT 0,
    "debutFenetre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("cle")
);
