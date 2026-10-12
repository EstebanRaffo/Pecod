ALTER TABLE "evaluation_attempts" ADD COLUMN "evaluationSnapshot" JSONB;

UPDATE "evaluation_attempts" AS attempt
SET "evaluationSnapshot" = jsonb_build_object(
  'id', evaluation.id,
  'title', evaluation.title,
  'minScore', evaluation."minScore",
  'questions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', question.id,
      'text', question.text,
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', option.id,
          'text', option.text,
          'isCorrect', option."isCorrect"
        ) ORDER BY option.id)
        FROM "question_options" AS option
        WHERE option."questionId" = question.id
      ), '[]'::jsonb)
    ) ORDER BY question."order", question.id)
    FROM "questions" AS question
    WHERE question."evaluationId" = evaluation.id
  ), '[]'::jsonb)
)
FROM "evaluations" AS evaluation
WHERE evaluation.id = attempt."evaluationId";

ALTER TABLE "evaluation_attempts" ALTER COLUMN "evaluationSnapshot" SET NOT NULL;