-- HU20: Agregar tabla de reseñas de cursos
CREATE TABLE "course_reviews" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "course_reviews_courseId_fkey" 
    FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE CASCADE,
  CONSTRAINT "course_reviews_studentId_fkey" 
    FOREIGN KEY ("studentId") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Una única reseña por (curso, alumno)
CREATE UNIQUE INDEX "course_reviews_courseId_studentId_key" 
  ON "course_reviews"("courseId", "studentId");

-- Índices para búsquedas
CREATE INDEX "course_reviews_courseId_idx" ON "course_reviews"("courseId");
CREATE INDEX "course_reviews_studentId_idx" ON "course_reviews"("studentId");
