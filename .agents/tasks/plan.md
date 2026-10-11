# Implementation Plan — Topic Media Previews with Delete Actions

## Findings from codebase exploration

**Q1 — Separate fields for uploaded-video vs screen-recording URL?**
No. `schema.prisma` has a single `videoUrl String?` on the `Topic` model. Both HU5 (upload file) and HU6 (screen recording) call the same `POST /topics/:topicId/video` endpoint and overwrite the same field. A new `screenRecordingUrl String?` column must be added so the two kinds of video coexist on a topic. DB is PostgreSQL (`datasource db { provider = "postgresql" }`). A migration must be run separately; the plan only edits `schema.prisma` and notes the command.

**Q2 — Does `findDetail` include materials per topic?**
No. `courses.service.ts` → `findDetail` uses `select: { id, title, order, videoUrl }`. Materials are never returned, so the `Topic` type in `CourseEditorPage.tsx` has no `materials` property. Both the service and the frontend type must be updated.

**Q3 — Missing DELETE endpoints?**
The topics controller has no DELETE methods. Three endpoints are missing:
- `DELETE /topics/:topicId/video` — clear `videoUrl` and `videoDurationSeconds`
- `DELETE /topics/:topicId/screen-recording` — clear `screenRecordingUrl`
- `DELETE /topics/:topicId/materials/:materialId` — delete a Material row

**Q4 — Delete functions in `uploads.ts`?**
`uploads.ts` has no delete functions. Two API-call helpers must be added (they call the new backend endpoints; S3 cleanup is the backend's responsibility).

**Q5 — UI changes needed?**
`TopicMediaUploader.tsx` currently accepts only `topicId`, `hasVideo`, and `onChanged`. It knows nothing about screen-recording URLs or materials. It must receive the full topic media state and render three conditional preview blocks plus delete buttons. `CourseEditorPage.tsx` must pass the new props and update its local `Topic` type to include `screenRecordingUrl` and `materials`.

---

## Step-by-step plan

- [ ] 1. Add `screenRecordingUrl` field to the Topic model in `schema.prisma`.
      Add `screenRecordingUrl  String?  // S3 key/URL del video de grabación de pantalla (HU6)` on the line after `videoUrl`. Do NOT run the migration — the team runs it separately. Leave a comment in the file: `// MIGRATION PENDING: npx prisma migrate dev --name add_screen_recording_url`.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend\prisma\schema.prisma`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npm run build` — NestJS/TypeScript compile succeeds (Prisma client still compiles against the old generated types; a fresh `prisma generate` is needed before running the app, but the build check is sufficient here).

- [ ] 2. Run `prisma generate` so the Prisma client types include `screenRecordingUrl`.
      This step regenerates `@prisma/client` from the updated schema so TypeScript picks up the new field in all subsequent backend steps.
      Files: (generated, not edited manually)
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npx prisma generate` — exits with code 0 and prints "Generated Prisma Client".

- [ ] 3. Update `TopicsService` to handle `screenRecordingUrl` and to add the three delete methods.
      In `topics.service.ts`:
      - Change `attachVideo` to write only `videoUrl`/`videoDurationSeconds` (no change in logic, but confirm it does NOT touch `screenRecordingUrl`).
      - Add `attachScreenRecording(topicId, professor, dto)` — updates `screenRecordingUrl` on the topic. Reuse the same `getOwnedTopicOrThrow` guard.
      - Add `deleteVideo(topicId, professor)` — sets `videoUrl: null` and `videoDurationSeconds: null`.
      - Add `deleteScreenRecording(topicId, professor)` — sets `screenRecordingUrl: null`.
      - Add `deleteMaterial(topicId, materialId, professor)` — verifies ownership via `getOwnedTopicOrThrow`, then calls `prisma.material.delete({ where: { id: materialId } })`. Throw `NotFoundException` if the material does not exist or does not belong to the topic.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend\src\topics\topics.service.ts`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npm run test -- --testPathPattern=topics` — all existing tests pass (new methods are additions, not replacements).

- [ ] 4. Create `AttachScreenRecordingDto` for the new endpoint.
      Create `attach-screen-recording.dto.ts` in the dto folder. It is identical in structure to `AttachVideoDto` (same `videoUrl`/`videoDurationSeconds` fields, same validators) but named `screenRecordingUrl` instead of `videoUrl`. Add field `screenRecordingUrl: string` with `@IsNotEmpty()` and `videoDurationSeconds: number` with the same validators as `AttachVideoDto`.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend\src\topics\dto\attach-screen-recording.dto.ts`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npm run build` — compiles without errors.

- [ ] 5. Expose the new endpoints in `TopicsController`.
      Add the following routes (all `@Roles(Role.PROFESSOR)`, all guarded by existing `JwtAuthGuard`/`RolesGuard`):
      - `DELETE topics/:topicId/video` → `topicsService.deleteVideo(topicId, user)` — import `Delete` from `@nestjs/common`.
      - `DELETE topics/:topicId/screen-recording` → `topicsService.deleteScreenRecording(topicId, user)`.
      - `DELETE topics/:topicId/materials/:materialId` → `topicsService.deleteMaterial(topicId, materialId, user)`.
      Also add `POST topics/:topicId/screen-recording` → `topicsService.attachScreenRecording(topicId, user, dto)` using `AttachScreenRecordingDto`. (The frontend already handles the upload to S3 via the same `uploadFileToS3` function; this endpoint just persists the URL, mirroring how `POST topics/:topicId/video` works today.)
      Import `Delete` alongside the existing `Body, Controller, Get, Param, Patch, Post, UseGuards`.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend\src\topics\topics.controller.ts`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npm run build` — NestJS build passes.

- [ ] 6. Update `findDetail` in `CoursesService` to include materials for each topic.
      Change the `topics` select clause from a bare `select` to an `include` (or add `include: { materials: true }` inside the existing select). The exact change:
      Replace:
      ```ts
      select: { id: true, title: true, order: true, videoUrl: true }
      ```
      With:
      ```ts
      select: { id: true, title: true, order: true, videoUrl: true, screenRecordingUrl: true, materials: true }
      ```
      This returns all material rows for each topic so the frontend can display them without an additional request.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend\src\courses\courses.service.ts`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\backend && npm run build` — build passes.

- [ ] 7. Add delete API helper functions to `uploads.ts` on the frontend.
      Add three exported async functions that call `api.delete(...)`:
      ```ts
      export async function deleteTopicVideo(topicId: string): Promise<void> {
        await api.delete(`/topics/${topicId}/video`);
      }
      export async function deleteTopicScreenRecording(topicId: string): Promise<void> {
        await api.delete(`/topics/${topicId}/screen-recording`);
      }
      export async function deleteMaterial(topicId: string, materialId: string): Promise<void> {
        await api.delete(`/topics/${topicId}/materials/${materialId}`);
      }
      ```
      No new libraries needed — `api` is the existing Axios instance from `./client`.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend\src\api\uploads.ts`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend && npm run build` — TypeScript + Vite build passes.

- [ ] 8. Update the `Topic` type and `TopicMediaUploader` props in `CourseEditorPage.tsx`.
      In `CourseEditorPage.tsx`:
      - Extend the `Topic` interface to add `screenRecordingUrl?: string | null` and `materials?: Material[]`.
      - Add a `Material` interface: `{ id: string; fileName: string; fileUrl: string; fileType: string; }`.
      - Pass the new fields as props to `<TopicMediaUploader>`: replace the current `hasVideo={!!topic.videoUrl}` call with:
        ```tsx
        <TopicMediaUploader
          topicId={topic.id}
          videoUrl={topic.videoUrl ?? null}
          screenRecordingUrl={topic.screenRecordingUrl ?? null}
          materials={topic.materials ?? []}
          onChanged={loadCourse}
        />
        ```
      - Remove the `{topic.videoUrl && <span className="...">Con video</span>}` badge — the preview inside the uploader makes it redundant.
      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend\src\pages\CourseEditorPage.tsx`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend && npm run build` — may fail until step 9 updates the component signature; that is expected. Run the build check only after step 9.

- [ ] 9. Rewrite `TopicMediaUploader.tsx` props interface and add the three preview+delete blocks.
      **Props interface** — replace the current `Props`:
      ```ts
      interface Props {
        topicId: string;
        videoUrl: string | null;
        screenRecordingUrl: string | null;
        materials: Array<{ id: string; fileName: string; fileUrl: string; fileType: string }>;
        onChanged: () => void;
      }
      ```
      The `hasVideo` prop is removed; derive it from `videoUrl !== null`.

      **Import** the three new delete helpers from `../api/uploads`:
      ```ts
      import { getVideoDurationSeconds, uploadFileToS3, deleteTopicVideo, deleteTopicScreenRecording, deleteMaterial } from '../api/uploads';
      ```

      **Screen-recording upload wiring** — The `handleStopRecording` function currently calls `attachVideo`. Change it to call a new `attachScreenRecording` helper that POSTs to `/topics/${topicId}/screen-recording` (same shape as `attachVideo` but different endpoint). Add this helper inside the component (it does not need to be in `uploads.ts` since it is a topic-domain call, not an S3 call — use `api.post` directly, mirroring the existing `attachVideo` inline call).

      **Three preview blocks** — render them between the action buttons row and the status/error lines. Use Tailwind classes consistent with the rest of the page (`border rounded`, `text-sm`, `text-slate-700`, `text-slate-500`, `underline`, `text-red-600`):

      **Preview 1 — uploaded video (`videoUrl`):**
      ```tsx
      {videoUrl && (
        <div className="mt-2 border rounded p-2 space-y-1">
          <p className="text-xs text-slate-500">Vista previa — video subido</p>
          <video src={videoUrl} controls className="w-full rounded" style={{ maxHeight: '240px' }} />
          <button
            type="button"
            onClick={handleDeleteVideo}
            className="flex items-center gap-1 text-xs text-red-600 underline"
          >
            <TrashIcon /> Eliminar video
          </button>
        </div>
      )}
      ```

      **Preview 2 — screen recording (`screenRecordingUrl`):**
      Same structure as Preview 1 but reads from `screenRecordingUrl`, label is "Vista previa — grabación de pantalla", and the delete handler calls `handleDeleteScreenRecording`.

      **Preview 3 — materials list:**
      ```tsx
      {materials.length > 0 && (
        <div className="mt-2 border rounded p-2 space-y-1">
          <p className="text-xs text-slate-500">Material adjunto</p>
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <a href={m.fileUrl} target="_blank" rel="noreferrer"
                 className="text-xs text-slate-700 underline truncate max-w-[70%]">
                {m.fileName}
              </a>
              <button
                type="button"
                onClick={() => handleDeleteMaterial(m.id)}
                className="flex items-center gap-1 text-xs text-red-600 underline ml-2 shrink-0"
              >
                <TrashIcon /> Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
      ```

      **`TrashIcon` inline SVG** — add a small inline SVG component at the top of the file (no new library):
      ```tsx
      function TrashIcon() {
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      }
      ```

      **Delete handlers** — add three async handlers inside the component, each calling the corresponding helper then `onChanged()` (optimistic local state is not needed because `onChanged` triggers `loadCourse` in the parent which already updates state):
      ```ts
      async function handleDeleteVideo() {
        try {
          await deleteTopicVideo(topicId);
          onChanged();
        } catch { setError('No se pudo eliminar el video.'); }
      }
      async function handleDeleteScreenRecording() {
        try {
          await deleteTopicScreenRecording(topicId);
          onChanged();
        } catch { setError('No se pudo eliminar la grabación.'); }
      }
      async function handleDeleteMaterial(materialId: string) {
        try {
          await deleteMaterial(topicId, materialId);
          onChanged();
        } catch { setError('No se pudo eliminar el material.'); }
      }
      ```

      **Upload label update** — the "Subir video (archivo)" label text should stay as-is when `videoUrl` is null and read "Reemplazar video (archivo)" when `videoUrl` is set — this logic already exists via `hasVideo`; replace `hasVideo` with `videoUrl !== null`. Same for screen-recording: label is "Grabar pantalla" when null, "Volver a grabar pantalla" when set.

      Files: `c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend\src\components\TopicMediaUploader.tsx`
      Verify: `cd c:\Users\Asus\Documents\Informática\Testing de Aplicaciones\TPI\pecod\frontend && npm run build` — TypeScript + Vite build passes with zero errors.

---

## Notes

- **Migration**: After editing `schema.prisma` (step 1), the team must run `cd backend && npx prisma migrate dev --name add_screen_recording_url` before deploying. The plan does not automate this to avoid touching a production-connected database.
- **S3 cleanup**: The DELETE endpoints clear the DB field and do not attempt to delete the file from S3. This is intentional — S3 lifecycle policies handle orphan cleanup, and adding the AWS SDK call here was not part of the requested scope.
- **No new npm packages** are added anywhere in this plan.
- **Visual consistency**: All new UI uses Tailwind classes already present in the file (`text-slate-700`, `text-red-600`, `underline`, `border rounded`, `text-xs`, `text-sm`, `p-2`, `mt-2`).
