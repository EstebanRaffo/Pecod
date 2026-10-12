CREATE TABLE "topic_progress" (
    "enrollmentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("enrollmentId", "topicId")
);

CREATE INDEX "topic_progress_topicId_idx" ON "topic_progress"("topicId");

ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;