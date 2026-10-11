# Presigned GET URLs for private S3 files

S3 objects previously stored as public-read are now private. The `ACL: 'public-read'` option has been removed from `PutObjectCommand`, and a new `generatePresignedGetUrl` method on `UploadsService` issues time-limited signed GET URLs. `CoursesService.findDetail` and `TopicsService.getContent` — the two read paths that return topic/material URLs — now replace every stored URL with a fresh presigned one before sending the response. `UploadsModule` is exported and imported by both `TopicsModule` and `CoursesModule` to make the service available.

Watch for: the key-extraction regex uses `https?` but the URL builder in `requestUploadUrl` hardcodes `https://`, so the `http` branch is dead — not a bug, but worth noting. More importantly, `findDetail` exposes presigned URLs to unauthenticated or non-enrolled students because it runs the URL replacement unconditionally before checking enrollment status — **confirmed**. Also, the `catalog` endpoint and `findMine` return raw stored URLs without presigning, which would 403 if those fields are ever rendered — **confirmed** for `findMine`, which includes the full course row.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The key-extraction regex (`url.replace(/^https?:\/\/[^/]+\//, '')`) correctly strips the scheme and host from the canonical S3 URL format (`https://<bucket>.s3.<region>.amazonaws.com/<key>`), leaving just the relative key. This works for all URLs produced by `requestUploadUrl` since they follow exactly that format. The `http?` variant is theoretically unnecessary but harmless.

`findDetail` in `CoursesService` transforms URLs for all topics before the enrollment gate. A student who is not enrolled still receives presigned, playable URLs for every topic in the course — the enrollment check only toggles the `isEnrolled` flag and does not prevent the URL conversion from running.

`catalog` and `findMine` skip URL replacement entirely. `catalog` selects no URL fields, so it is not affected. `findMine` returns full course rows and does not include topic or material URL fields (topics are not `include`d), so it is also safe for now — but the coupling is implicit and would break silently if a `topics` include were added later.

The `generatePresignedGetUrl` signature defaults to 3600 seconds (1 hour). That means a URL embedded in a page response stays valid for up to an hour after the tab is closed; acceptable for this use case but worth knowing if tighter expiry is ever required.

---

<details>
<summary>Issues (2)</summary>

1. **Enrollment bypass in `findDetail`** — `CoursesService.findDetail` generates presigned URLs for all topics unconditionally, then checks enrollment afterward. A non-enrolled student who calls the course detail endpoint receives fully playable, signed video and material URLs. Move the enrollment check (or at minimum the URL transformation) so that URL signing only happens after access has been confirmed, or strip URL fields from the response when `isEnrolled` is false.

2. **`findMine` implicit coupling** — `CoursesService.findMine` returns the raw Prisma course row without topics. This is safe today because topics are not included. If a `topics: { include: { materials: true } }` is ever added (e.g. for a richer professor dashboard), stored S3 URLs would leak into the response without presigning, and the objects would 403. Add a comment to `findMine` noting that any future `topics` include must go through `generatePresignedGetUrl`, or centralize the URL-replacement logic so it applies automatically.

</details>

---

<details>
<summary>Details</summary>

### Key extraction and URL format contract

`requestUploadUrl` constructs the stored URL as:

```
https://<bucket>.s3.<region>.amazonaws.com/<kind>/<uuid>-<filename>
```

The extraction regex `url.replace(/^https?:\/\/[^/]+\//, '')` removes everything up to and including the first `/` after the host, leaving `<kind>/<uuid>-<filename>` as the key. That matches exactly what S3 expects. The `http` alternative in the regex is unreachable (the builder always emits `https`), but it causes no harm.

One edge case worth checking: if a filename contains `%`-encoded characters (e.g. `Instalaci%C3%B3n`) the key string is preserved as-is and passed to `GetObjectCommand`. S3 SDK v3 does not double-encode keys, so this is correct — the stored key already has the encoded form since it was derived from the original filename at upload time.

### Enrollment bypass in `findDetail` — confirmed

```typescript
// courses.service.ts — findDetail
const topics = await Promise.all(
  course.topics.map(async (topic) => {
    const videoUrl = topic.videoUrl
      ? await this.uploadsService.generatePresignedGetUrl(urlToKey(topic.videoUrl))
      : topic.videoUrl;
    // ...
  }),
);

// enrollment check happens here, AFTER topics are signed
let isEnrolled = false;
if (user.role === Role.STUDENT) {
  const enrollment = await this.prisma.enrollment.findUnique({ ... });
  isEnrolled = !!enrollment;
}

return { ...course, topics, isEnrolled };
```

The signed `topics` array — including video and material URLs — is always present in the response regardless of `isEnrolled`. A non-enrolled student can call `GET /courses/:id` and receive valid, playable signed URLs for every video in the course. The `isEnrolled: false` flag is only meaningful if the frontend chooses to hide the content; the backend provides no enforcement here.

The fix is to either replace URL fields with `null` when `isEnrolled` is false, or to restructure `findDetail` so the URL transformation only runs for enrolled users (or professors).

### `findMine` implicit coupling

`findMine` issues a bare `findMany` with no `include`. Since the Prisma schema puts `videoUrl` and `screenRecordingUrl` on `Topic`, not on `Course`, and topics are not included, no URL fields appear in the response. The risk is that a future developer adds `include: { topics: { include: { materials: true } } }` to enrich the professor's course list without knowing about the presigning requirement. Adding a comment is a low-cost safeguard.

</details>

---

<details>
<summary>File map</summary>

- `src/uploads/uploads.service.ts` — added `generatePresignedGetUrl(key, expiresIn)` using `GetObjectCommand`; removed `ACL: 'public-read'` from `PutObjectCommand`
- `src/uploads/uploads.module.ts` — added `exports: [UploadsService]`
- `src/topics/topics.service.ts` — injected `UploadsService`; `getContent` replaces videoUrl, screenRecordingUrl, and each material's fileUrl with presigned GET URLs
- `src/topics/topics.module.ts` — added `UploadsModule` to imports
- `src/courses/courses.service.ts` — injected `UploadsService`; `findDetail` replaces all topic and material URLs with presigned GET URLs (before the enrollment gate — see Issues)
- `src/courses/courses.module.ts` — added `UploadsModule` to imports

Full diff: `git diff main -- backend/src/uploads backend/src/topics backend/src/courses`

</details>
