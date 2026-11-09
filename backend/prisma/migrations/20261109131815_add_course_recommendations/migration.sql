-- AlterEnum
-- This migration adds a new enum variant `COURSE_RECOMMENDED` which was not part of the previous schema.
-- This is a safe operation as we are only adding a new variant and not removing an existing one.
ALTER TYPE "ContentEvent" ADD VALUE 'COURSE_RECOMMENDED';

-- AlterTable: make topicTitle nullable for course recommendations (HU24)
ALTER TABLE "notifications" ALTER COLUMN "topicTitle" DROP NOT NULL;

-- CreateIndex: for efficient lookups of courses already recommended
-- Note: The unique partial index is applied in a separate migration to work around PostgreSQL
-- enum value usage restrictions
CREATE INDEX "notifications_courseId_event_idx" 
  ON "notifications"("courseId", "event");

