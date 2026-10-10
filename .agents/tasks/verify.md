# Verification Note

## Frontend build
**Result: PASS**
Command: `cd frontend && npm run build`
Output: `tsc -b` type-check succeeded, Vite bundled 95 modules to `dist/` in 1.30 s (zero TypeScript errors, zero Vite errors).

## Backend build
**Result: PASS**
Command: `cd backend && npm run build`
Output: `nest build` exited with code 0 (zero TypeScript errors).

## Prisma generate
**Result: PASS**
`npx prisma generate` regenerated the Prisma client from the updated schema (added `screenRecordingUrl String?` to the `Topic` model). Exit code 0.

## Migration status
⚠️ The `screenRecordingUrl` column was added to `schema.prisma` but the database migration has NOT been run.
The team must execute the following before deploying:
```
cd backend
npx prisma migrate dev --name add_screen_recording_url
```

## Changes implemented
- `backend/prisma/schema.prisma`: added `screenRecordingUrl String?` to `Topic`.
- `backend/src/topics/dto/attach-screen-recording.dto.ts`: new DTO for screen-recording attach.
- `backend/src/topics/topics.service.ts`: added `attachScreenRecording`, `deleteVideo`, `deleteScreenRecording`, `deleteMaterial`.
- `backend/src/topics/topics.controller.ts`: added `POST /topics/:id/screen-recording`, `DELETE /topics/:id/video`, `DELETE /topics/:id/screen-recording`, `DELETE /topics/:id/materials/:materialId`.
- `backend/src/courses/courses.service.ts`: `findDetail` now selects `screenRecordingUrl` and `materials` per topic.
- `frontend/src/api/uploads.ts`: added `deleteTopicVideo`, `deleteTopicScreenRecording`, `deleteMaterial` helpers.
- `frontend/src/pages/CourseEditorPage.tsx`: added `Material` interface, extended `Topic` with `screenRecordingUrl` and `materials`; removed "Con video" badge; passes new props to `<TopicMediaUploader>`.
- `frontend/src/components/TopicMediaUploader.tsx`: new props interface; HU6 now posts to `/screen-recording` endpoint; three preview+delete blocks added.
