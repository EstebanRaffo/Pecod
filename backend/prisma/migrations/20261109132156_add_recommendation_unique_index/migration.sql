-- CreateIndex: unique partial index for course recommendations to avoid duplicates
-- This ensures that a student receives each course recommendation only once
-- Applied in a separate migration after the enum value COURSE_RECOMMENDED has been committed
CREATE UNIQUE INDEX "notifications_studentId_courseId_event_key" 
  ON "notifications"("studentId", "courseId", "event") 
  WHERE "event" = 'COURSE_RECOMMENDED';
