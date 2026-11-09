-- HU26: Agregar precio a cursos y crear modelo Payment para pago simulado

-- Crear enum PaymentStatus
CREATE TYPE "PaymentStatus" AS ENUM ('APPROVED', 'REJECTED');

-- Agregar columna price a courses
ALTER TABLE "courses" ADD COLUMN "price" NUMERIC(10,2);

-- Crear tabla payments
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" NUMERIC(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "status" "PaymentStatus" NOT NULL,
    "rejectionReason" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Agregar índices en payments
CREATE INDEX "payments_studentId_courseId_idx" ON "payments"("studentId", "courseId");
CREATE INDEX "payments_studentId_createdAt_idx" ON "payments"("studentId", "createdAt");
CREATE INDEX "payments_courseId_createdAt_idx" ON "payments"("courseId", "createdAt");

-- Índice único parcial: prevenir doble pago aprobado del mismo estudiante a mismo curso
-- Este índice asegura idempotencia: confirmar dos veces solo crea un Payment aprobado y una Enrollment
CREATE UNIQUE INDEX "payments_studentId_courseId_approved_unique" 
ON "payments"("studentId", "courseId") 
WHERE "status" = 'APPROVED';

-- Agregar constraints de FK a payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" 
FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_courseId_fkey" 
FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE;
