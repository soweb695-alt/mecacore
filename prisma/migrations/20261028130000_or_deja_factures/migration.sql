-- OR terminés avant N4 dont le devis est déjà facturé (facture émise) : ils n'ont plus rien à traiter.
UPDATE "OrdreReparation" o
SET statut = 'FACTURE', "updatedAt" = NOW()
FROM "Facture" f
WHERE f."devisId" = o."devisId" AND o.statut = 'A_TRAITER_MAGASIN' AND f.statut <> 'BROUILLON';
