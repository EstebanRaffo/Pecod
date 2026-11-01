-- HU19: Agregar columna maxAttempts a tabla evaluations
ALTER TABLE "evaluations" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 2;
