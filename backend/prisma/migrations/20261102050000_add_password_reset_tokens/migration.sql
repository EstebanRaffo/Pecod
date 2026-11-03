-- HU22: Agregar soporte para recuperación de contraseña

-- Agregar columna passwordChangedAt a users
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Crear tabla de tokens para restablecimiento de contraseña
CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Índices para búsquedas y validaciones
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
