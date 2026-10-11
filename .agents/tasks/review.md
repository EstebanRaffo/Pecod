# Material de Lectura — inline editor for topic reading material

The change adds a fourth action to the topic editor allowing professors to write free-form text and paste external documentation links, stored as `contentText` on the `topics` table. The implementation spans a new optional field in the Prisma schema (included in the initial migration SQL rather than as a separate `ALTER TABLE`), a `@MaxLength(50000)` DTO guard, a service patch, and a React inline editor with cancel confirmation. The design is consistent with the existing video/material action pattern.

Watch for: **(1)** the schema change bypassed the migration system by editing `migration_v1` SQL in place, leaving any already-initialized database without the column (confirmed, blocking); **(2)** `ReadingMaterialDisplay` includes trailing punctuation in matched URLs, producing broken `href` values — e.g., `https://docs.example.com.` with a trailing period (confirmed, advisory); **(3)** save-failure errors surface at the bottom of the container, not inside the editor panel where the professor's focus is (confirmed, advisory).

**Verdict**: NEEDS_CHANGES

---

## High-level view

The `contentText` field is correctly included in the professor-facing `findDetail` query, pre-loaded into the draft on editor open, and persisted via `PATCH /topics/:topicId` which is gated behind `@Roles(Role.PROFESSOR)` and ownership checks. The cancel path compares `draftReading` against `contentText ?? ''` before deciding whether to show the confirmation dialog — correct behavior.

The schema change was made by editing the initial `migration_v1` SQL file in place. Any database already initialized from that migration does not have the `contentText` column and will fail at runtime with a Prisma error on every `PATCH` that includes `contentText`. A separate `ALTER TABLE` migration is the required fix.

`ReadingMaterialDisplay` uses `/https?:\/\/[^\s]+/g` and renders each match directly as `<a href={url}>`. The regex does not strip trailing punctuation, so a URL written as `See https://docs.example.com.` produces an anchor pointing to `https://docs.example.com.` (broken). React's JSX sanitizes `javascript:` URIs implicitly since 16.9, so there is no active XSS vector, but the implementation depends on that implicit guarantee rather than an explicit scheme check.

`getContent` in `topics.service.ts` uses an unscoped `include` that returns all columns, so enrolled students receive `contentText` via `GET /topics/:topicId`. If the intent is to gate reading material the same way video URLs are gated in `findDetail`, no such exclusion exists on this path.

---

<details>
<summary>Issues (4)</summary>

1. **Missing ALTER TABLE migration** — `contentText` was added by editing `migration_v1` SQL in place. Existing databases won't have the column; `PATCH /topics/:topicId` with `contentText` will throw a Prisma runtime error. Add `ALTER TABLE "topics" ADD COLUMN "contentText" TEXT;` as a new migration file. (blocking)

2. **Trailing punctuation in matched URLs** — the `https?://[^\s]+` regex includes trailing `.`, `)`, `,` etc. in the `href`. Strip trailing punctuation before constructing the anchor: `url.replace(/[.,;:!?)]+$/, '')`. (advisory)

3. **Save-failure error not displayed inside editor panel** — `handleSaveReading` sets the shared `error` state which renders at the bottom of `TopicMediaUploader`, potentially below the fold. The error message should appear adjacent to the Guardar/Cancelar buttons inside the open editor. (advisory)

4. **`contentText` not in explicit exclusion path for future access widening** — `getContent` returns all columns for enrolled users, so `contentText` is accessible to students. This is likely intentional, but it is not explicitly handled. If a topic preview for unenrolled students is ever added, `contentText` will leak without a code change. Consider adding it to the strip-down block in `findDetail` for unenrolled users to make the intent explicit. (advisory)

</details>

<details>
<summary>Details</summary>

### Missing migration for `contentText`

The `contentText TEXT` column appears inside `backend/prisma/migrations/20260924000109_migration_v1/migration.sql`, the initial table creation script. The migrations directory contains exactly two entries (`migration_v1` and `add_screen_recording_url`), neither of which adds `contentText` via `ALTER TABLE`. A database initialized before this commit has no `contentText` column; `prisma migrate deploy` will not add it because Prisma considers `migration_v1` already applied. The fix is a new migration file with `ALTER TABLE "topics" ADD COLUMN "contentText" TEXT;`.

### Trailing punctuation in rendered URLs

`ReadingMaterialDisplay` matches `/https?:\/\/[^\s]+/g` and passes the raw match as `href`. Natural prose like `Documentación: https://docs.example.com.` or `(ver https://example.com/page)` produces `href="https://docs.example.com."` and `href="https://example.com/page)"` respectively — both are broken links. Adding a trailing-punctuation strip (`url.replace(/[.,;:!?)]+$/, '')`) before constructing the anchor fixes this without changing the display text.

React's JSX does block `javascript:` URIs as of React 16.9 (`Blocked attribute href for an anchor tag`), so there is no active XSS path, but the code has no explicit scheme validation. An explicit `startsWith('http://') || startsWith('https://')` guard makes the safety contract explicit and removes reliance on React's internal sanitization.

### Save-failure error placement

`handleSaveReading` on error calls `setError(err.response?.data?.message ?? 'No se pudo guardar...')`. The error is rendered by a `<p className="text-red-600">` at the very end of `TopicMediaUploader`'s JSX, below video previews and material attachments. A professor editing a topic partway down a long course list will not see it without scrolling. The error should render inside the `readingOpen` panel, adjacent to the action buttons.

</details>

---

<details>
<summary>File map</summary>

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Added `contentText String?` to `Topic` model |
| `backend/prisma/migrations/20260924000109_migration_v1/migration.sql` | Edited in-place to include `contentText` column (no separate migration created) |
| `backend/src/topics/dto/update-topic.dto.ts` | Added optional `contentText` with `@MaxLength(50000)` |
| `backend/src/topics/topics.service.ts` | Added `contentText` to the conditional update spread |
| `backend/src/topics/topics.service.spec.ts` | Three unit tests for `contentText` update authorization and empty-string acceptance |
| `backend/src/courses/courses.service.ts` | Added `contentText` to `findDetail` topic select |
| `frontend/src/pages/CourseEditorPage.tsx` | Added `contentText` to `Topic` interface; passes it to `TopicMediaUploader` |
| `frontend/src/components/TopicMediaUploader.tsx` | Fourth action button, inline editor, cancel confirmation, `ReadingMaterialDisplay`, `ConfirmDialog` parameterization |
| `frontend/cypress/e2e/reading-material.cy.ts` | E2E tests covering button visibility, editor open, cancel confirmation, save with link rendering |

Full diff: `git diff a469711..HEAD`

</details>
