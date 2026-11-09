-- HU23: Agregar campo emailVerifiedAt a users
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- HU23: Backfill para usuarios existentes (todos verificados al migrar)
UPDATE "users" SET "emailVerifiedAt" = now();

-- HU23: Crear tabla institution_email_domains
CREATE TABLE "institution_email_domains" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_email_domains_pkey" PRIMARY KEY ("id")
);

-- HU23: Crear tabla email_verification_tokens
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- HU23: Índices para institution_email_domains
CREATE UNIQUE INDEX "institution_email_domains_institutionId_domain_key" ON "institution_email_domains"("institutionId", "domain");
CREATE INDEX "institution_email_domains_domain_idx" ON "institution_email_domains"("domain");

-- HU23: Índices para email_verification_tokens
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");
CREATE INDEX "email_verification_tokens_tokenHash_idx" ON "email_verification_tokens"("tokenHash");

-- HU23: Agregar restricción de clave foránea
ALTER TABLE "institution_email_domains" ADD CONSTRAINT "institution_email_domains_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
