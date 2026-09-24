# OMLU photo pipeline audit

Audit date: 24 September 2026. Repository baseline: `dcda5a4`. Scope: audit only; no application behavior changes, camera replacement, feed redesign, Flutter project, commit, push, or deployment.

**The code establishes why quality is limited and why posting feels slow. It does not establish which network stage consumes the reported 6–15 seconds on a phone.** Local backend measurements and controlled source-function experiments are included below; phone camera, encoding, Cloudinary upload, and end-to-end paint timings remain unmeasured. No authenticated phone session, representative photo, or staging configuration was supplied during this audit.

Evidence labels: **source-confirmed**, **measured locally**, **controlled reproduction** (real source function with simulated dependencies), **hypothesis**, and **proposed target**. These are not interchangeable.

## A. Current architecture

Next.js 16.3.6 / React 19.2.8 handles client UI and authentication state. FastAPI owns bearer-token authentication, Space membership, Memories (the backend term for Drops), social data, and upload signing. SQLAlchemy uses async PostgreSQL. Browser image bytes go directly to Cloudinary through XHR; FastAPI receives asset metadata only.

The current route is a rapid live-camera experience with an in-component upload queue. It is not a durable background uploader. A PWA manifest exists, but no service worker, IndexedDB photo queue, or persistent pending-Drop store was found.

The README describes a gallery flow, 2048-pixel downsampling, upload percentage UI, and multiple-photo creation that do not describe the active camera route. `processImageForUpload` has no callers in `frontend/src`; `/memory/new` redirects to `/camera`. The backend supports 1–10 photos, but each live shutter creates a separate one-photo Memory.

Relevant entry points and supporting files:

| Responsibility | File / function |
|---|---|
| Open capture from + | [BottomNav](/Users/kailasanadhg/Documents/Omlu/frontend/src/components/navigation/BottomNav.tsx:15) → [SpaceSelectorSheet.handleSelectSpace](/Users/kailasanadhg/Documents/Omlu/frontend/src/components/navigation/SpaceSelectorSheet.tsx:46); selector first fetches `/spaces` |
| Legacy composer route | [MemoryNewRedirect](/Users/kailasanadhg/Documents/Omlu/frontend/src/app/memory/new/page.tsx:6) |
| Auth hydration / token | [AuthProvider](/Users/kailasanadhg/Documents/Omlu/frontend/src/lib/auth.tsx:22), [apiRequest](/Users/kailasanadhg/Documents/Omlu/frontend/src/lib/api.ts:7) |
| Stream, shutter, queue | [LiveCameraView](/Users/kailasanadhg/Documents/Omlu/frontend/src/app/camera/page.tsx:18) |
| Dormant image processor | [processImageForUpload](/Users/kailasanadhg/Documents/Omlu/frontend/src/lib/imageUtils.ts:15) |
| Upload and image URLs | [uploadDirectToCloudinary / getOptimizedImageUrl](/Users/kailasanadhg/Documents/Omlu/frontend/src/lib/cloudinary.ts:17) |
| Permission and signature | [get_cloudinary_signature](/Users/kailasanadhg/Documents/Omlu/backend/app/api/v1/media.py:15), [generate_upload_signature](/Users/kailasanadhg/Documents/Omlu/backend/app/core/cloudinary_service.py:19), [get_current_user](/Users/kailasanadhg/Documents/Omlu/backend/app/api/deps.py:15) |
| Write/read/serialize | [create_memory / feed endpoints / format_memory_out](/Users/kailasanadhg/Documents/Omlu/backend/app/api/v1/memories.py:25), [get_db](/Users/kailasanadhg/Documents/Omlu/backend/app/core/database.py:28) |
| Schema and migrations | [Memory model](/Users/kailasanadhg/Documents/Omlu/backend/app/models/memory.py:17), [Media model](/Users/kailasanadhg/Documents/Omlu/backend/app/models/media.py:12), [Memory schemas](/Users/kailasanadhg/Documents/Omlu/backend/app/schemas/memory.py:8), [Media schemas](/Users/kailasanadhg/Documents/Omlu/backend/app/schemas/media.py:18), [initial migration](/Users/kailasanadhg/Documents/Omlu/backend/alembic/versions/92430cb1d2a2_initial_omlu_schema.py), [notes migration](/Users/kailasanadhg/Documents/Omlu/backend/alembic/versions/47b067eb6940_add_notes_table.py) |
| Return to Space | [SpaceDetailPage.fetchSpace](/Users/kailasanadhg/Documents/Omlu/frontend/src/app/spaces/[id]/page.tsx:40), [get_space / list_space_members](/Users/kailasanadhg/Documents/Omlu/backend/app/api/v1/spaces.py:210) |
| Finally show photo | [MemoryCard](/Users/kailasanadhg/Documents/Omlu/frontend/src/components/feed/MemoryCard.tsx), [Carousel](/Users/kailasanadhg/Documents/Omlu/frontend/src/components/feed/Carousel.tsx:14), [MemoriesGrid](/Users/kailasanadhg/Documents/Omlu/frontend/src/components/space/MemoriesGrid.tsx:15) |
| Home refresh | [HomePage.fetchData](/Users/kailasanadhg/Documents/Omlu/frontend/src/app/page.tsx:34) |

## B. Exact camera implementation

`LiveCameraView` starts its camera effect on mount and on `[facingMode, retryCount]`. It stops an existing stream, calls `getUserMedia`, saves the returned stream, and attaches it only if `videoRef.current` exists at that moment. Permission is part of `getUserMedia`; there is no separate permission request or timing.

| Setting | Current behavior |
|---|---|
| Facing | `environment` initially, `user` when switched; **ideal**, not guaranteed |
| Resolution | Ideal 1920 × 1080; actual width/height never inspected via `getSettings()` |
| Aspect / frame rate | No explicit `aspectRatio` or `frameRate` constraint |
| Focus / exposure | No capabilities inspection, tap-to-focus, focus lock, exposure control, or still-photo exposure request; device/browser defaults |
| Video | `playsInline`, `autoPlay`, `muted`; `object-cover` inside a 3:4 box |
| Ready state | Set on `loadedmetadata`; `play()` is called but not awaited; no first-frame check |
| Capture | Detached DOM `<canvas>` with `drawImage(video, …)`; **not** a worker `OffscreenCanvas` and **not** `ImageCapture.takePhoto()` |
| Capture dimensions | `video.videoWidth × video.videoHeight`; fallback 1080 × 1920 if zero, instead of rejecting an unready frame |
| Encoding | `canvas.toBlob(..., 'image/jpeg', 0.92)` once |
| Front camera | Saved pixels flipped horizontally, but live preview has no matching mirror transform |
| Pixel ratio | No `devicePixelRatio` used in capture; this is correct for intrinsic video pixels. Multiplying by DPR cannot recover sensor detail |
| Metadata | Canvas produces new raster JPEG, without the phone photo's EXIF/GPS/date; API date defaults to the UTC posting date |

**Startup race, source-confirmed and reproduced with controlled dependencies:** while auth or Space details load, the render returns a spinner and no video. If an already-authorized camera resolves first, the effect saves the stream but skips attachment. When the video later mounts, neither dependency changes and attachment is never retried. Result: “Starting camera…” indefinitely despite a live stream. The control experiment with the video mounted first attaches successfully. This explains one unresponsive-camera failure, not a measured preview FPS deficit.

Ordinary status/count/flash React re-renders do **not** restart this effect. Flipping, retrying, navigation/unmount, and development effect replay can restart streams. There is no continuous React frame-processing loop. The cleanup stops tracks; a late cancelled request also stops its returned stream. Do not diagnose every re-render as camera destruction.

## C. Exact upload/posting pipeline

1. Select a Space, route to `/camera?space_id=…`. Auth hydration may call `/auth/me`; camera independently fetches `/spaces/{id}` and requests camera access. UI visibility is gated on auth/Space loading.
2. Once marked ready, shutter attempts a 40 ms vibration and schedules a 120 ms white flash. These are requested durations, not measured feedback latency.
3. Allocate full-video-sized canvas, optionally mirror, synchronously call `drawImage`, asynchronously receive a JPEG blob at quality 0.92. There is no separate resize, file conversion, base64 roundtrip, or EXIF extraction in this route.
4. Append `{id, blob, width, height}` to `queueRef`. The random short ID is never sent to the backend or rendered as a Drop.
5. `processNextInQueue` removes the first entry before attempting upload and serializes all work with `isProcessingQueueRef`.
6. Await `POST /media/cloudinary-sign`. Bearer authentication loads User; endpoint verifies Membership. The signer locally generates timestamp, UUID public ID, and signature over folder/public ID/timestamp. Signing itself makes **no outbound Cloudinary request**.
7. Await XHR `POST https://api.cloudinary.com/v1_1/{cloud}/image/upload`. FormData contains the JPEG blob and five signing fields. No upload preset, incoming transform, eager transform, resizing, or additional encoding is specified in the request. Cloudinary account-level defaults were not inspected.
8. Await `POST /memories` containing Cloudinary result fields: public ID, asset ID, secure URL, format, width, height, bytes, and position. No caption or capture timestamp is sent.
9. Backend authenticates, loads Space and Membership, checks 1–10 images, inserts Memory (`flush`), adds Media rows, and commits atomically. It assigns positions by array order, ignoring supplied positions. It then rereads author/Space/media/notes and makes three more queries for likes, viewer-like, and comments before returning `201 MemoryOut`.
10. Camera discards that returned Memory object, decrements pending count, increments the “captured” count only now, and shows success. It stays on the camera page. A 2.5-second timer resets status. There is **no automatic feed refresh or navigation on success**.
11. The user closes camera. `SpaceDetailPage` requests Space, memories, and members in parallel, and waits for all three before updating state. The Memory list is loaded afresh; there is no shared feed cache updated by posting.
12. `MemoryCard` → `Carousel` mounts an `<img loading="lazy">` with a Cloudinary derivative URL; the browser requests, decodes, and paints it. Grid instead requests a 400 × 400 crop. The locally captured blob is never displayed/reused.

Thus the current path to seeing a photo includes an **arbitrary user navigation interval**. Closing before creation completes can fetch an old list, with no subsequent upload-completion subscription to refresh it. There is no finite automatic shutter-to-Space-display guarantee.

**Actual behavior verified in the isolated API:** all signature requests returned 200; five identical create requests returned 201 with five distinct Memory IDs; metadata pointing to an unuploaded `example.invalid` image was accepted. The API does not verify the uploaded asset or tie it to the issued signature.

## D. Measured timing breakdown

### What was actually measured

[Raw local samples](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/backend-results.json) contain every run. [Backend probe](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/backend_probe.py) invokes the unchanged FastAPI app via HTTPX ASGI transport and a real localhost PostgreSQL connection. It creates fixtures in a unique transactional schema and verifies that rollback removes the schema. Requests use a fresh session and fixture-user JWT. There are no likes, comments, or notes in the fixtures.

**Limits:** ASGI transport excludes browser, TCP/TLS, hosting, CORS, WAN, and Cloudinary. Database commits release savepoints under an outer rollback, so these are **not durable commit/fsync timings**. Small samples are reported as medians/ranges, not p95 claims. Existing application data was not queried or changed.

| Measured local stage | n | Median | Range | SQL per request |
|---|---:|---:|---:|---|
| Signature API | 5 | 1.908 ms | 1.769–9.030 ms | 2 SELECTs |
| Create one-photo Memory | 5 | 6.478 ms | 5.818–18.997 ms | 11 SELECTs + 2 INSERTs |
| Space feed, 5 Drops | 3 | 8.427 ms | 7.188–18.070 ms | 23 SELECTs |
| Space feed, 100 Drops | 3 | 55.288 ms | 44.248–59.333 ms | 308 SELECTs |
| Home feed, 50 Drops | 3 | 26.901 ms | 22.466–34.790 ms | 156 SELECTs |
| Space details | 1 | 5.507 ms | Single observation | 5 SELECTs |
| Space members | 1 | 1.906 ms | Single observation | 3 SELECTs |

Read-only HTTP probes of the already-running local services returned `/camera` 200 in 69.164 ms and `/health` 200 in 7.625 ms. These establish reachability only, not camera startup or authenticated posting latency.

### Requested real-device ledger

| Stage | Result / interpretation |
|---|---|
| Camera initialization | **Unmeasured**; permission time, stream acquisition, and first presented video frame must be separated |
| Shutter → captured image available | **Unmeasured**; bound from click to blob callback, with first preview paint measured separately |
| Image processing | **Unmeasured** `drawImage` duration; no standalone resizing pass exists |
| Compression | **Unmeasured** `toBlob` elapsed time; JPEG 0.92 is source-confirmed |
| Queue wait | **Unmeasured**; later captures wait for all preceding signature/upload/create operations |
| Signature API | Local 1.908 ms median above; phone network duration **unmeasured** |
| Cloudinary upload | **Unmeasured**; no live upload or representative mobile image was performed |
| Backend creation | Local 6.478 ms median above; hosted roundtrip and durable commit **unmeasured** |
| Feed refresh | Local endpoint measurements above; 3-request browser barrier + render/decode **unmeasured** |
| TOTAL | **Unmeasured**; 6–10 seconds / occasional ~15 seconds is user-reported, not independently reproduced |

Do not add backend medians together and call that end-to-end time. Shutter-to-blob already includes the draw/encode stages. Feed GETs overlap and must be measured as a barrier, not summed. User dwell before closing camera must be reported separately.

| Image property | Current evidence |
|---|---|
| Original dimensions | Actual video dimensions unknown; request is 1920 × 1080 ideal, **not an observed output** |
| Original file size | Not applicable before encoding: source is a video frame, not a native photo file |
| Processed dimensions | Equal to actual video dimensions except zero-dimension fallback; not measured on device |
| Processed bytes / uploaded bytes | Unknown for real capture; blob is sent unchanged in multipart FormData |
| Format / quality | Requested JPEG 0.92; verify returned blob MIME in runtime |
| Transfer overhead | Multipart boundaries/fields + HTTP/TLS overhead; Cloudinary `bytes` is asset size, not wire traffic |

A 1920 × 1080 frame would contain 2.07 MP and require about 7.9 MiB as RGBA before encoder/texture overhead. That is a calculation from the requested size, not an observed camera allocation. Synthetic fixture dimensions/bytes are deliberately excluded from photo-quality claims.

### Temporary measurement supplied

[Browser probe](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/browser_probe.js) is an opt-in DevTools snippet, never imported into production. Install on the Space page before client-side navigation to camera; take **one photo per run**, let creation finish, close to Space, and export its records. It wraps getUserMedia, video metadata/first-frame events, canvas draw/encode, actual fetch body reads, and XHR upload/progress; it observes long tasks where supported. It records constraints/settings/dimensions/quality/blob bytes and multipart progress, without tokens, image pixels, or asset URLs. `stop()` restores hooks; reload removes all in-flight hooks too.

Syntax checked only; **not executed against a phone**. Next-frame callbacks are rendering opportunities, not proof of flash paint. Image-load candidates can include other feed photos; correlate the new Drop in the browser performance/network trace for definitive first-paint timing. Upload progress is multipart payload bytes, not TCP/TLS wire bytes. Use DevTools/remote debugging for preflights, DNS/TLS, cache hits, response headers, and image decode.

Repeat on actual iOS Safari and Android Chrome, with already-granted versus new permissions, rear/front camera, bright/low light, cold/warm Cloudinary derivative, Wi-Fi/cellular, one capture/burst, and background/resume. Use a staging Space and non-personal test subject. Collect at least 20 warm samples per key scenario before reporting p50/p95; keep permission and cold-start cases separate. Add temporary server spans for auth, membership, flush, durable commit, reload, serializer, and total request time in that staging run, then remove them. The remaining real-device audit requires this session/trace.

## E. Camera-quality problems

**OMLU is limited by the preview stream.** It keeps the stream's intrinsic dimensions in canvas, so there is no evidence of an additional client downscale in this route. But it never requests a sensor-resolution still. It cannot recover detail, photo-specific exposure, or computational photography that was never present in the video frame. An ideal 1080p request also allows lower negotiated resolutions.

The 3:4 viewfinder visually crops the stream; the entire intrinsic frame is captured; the feed subsequently crops to a square with CSS. These are different compositions. Grid URLs also use `c_fill`. Saved master pixels are not cropped by the preview CSS, but the visible result can hide much of them. The front-camera save/preview mirror mismatch can further surprise users.

JPEG 0.92 introduces one lossy encoding. Feed delivery can introduce another through `q_auto`. No evidence supports blaming double *pre-upload* resizing/compression, WebP encoding, or EXIF rotation for the current live-camera quality gap. Browser video is already presented in its display orientation; verify rotation on hardware. A future file-input flow needs explicit EXIF orientation normalization before stripping metadata, and tests for HEIC/HDR/color profiles. The dormant processor uses `Image` decode + canvas and JPEG 0.88, and its raw-file fallback bypasses metadata stripping; it should not be activated without review.

For iOS and Android web, compare:

| Option | Quality and UX assessment |
|---|---|
| Current `getUserMedia` + canvas | Embedded continuous preview and rapid repeat captures, but captures a video frame; no native still-photo pipeline requested |
| `<input type="file" accept="image/*" capture="environment">` | Best practical cross-platform web candidate for obtaining a higher-resolution still through system capture UI; less control over UX, resolution, codec, and return timing; behavior varies by browser/OS |
| Existing native camera photo selected from library | Best option when the user needs the phone camera app's full modes/processing; adds a separate app/picker workflow and may still involve browser transcoding |
| `ImageCapture.takePhoto()` | Can request an actual still from a track, but support/capabilities must be feature-detected; not a universal iOS/Android replacement |

The recommendation to trial system capture for quality is an architectural inference, **not** a measured iOS-versus-Android image comparison. `capture` is a hint with limited availability, not a guarantee of full OEM camera-app quality or a chosen megapixel count. See [MDN capture behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture), [track settings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings), and [takePhoto](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture/takePhoto). No replacement was implemented.

## F. Posting-performance problems

| Audit question | Finding |
|---|---|
| Upload original full-resolution phone photo? | No. Uploads the complete encoded **video frame**, not a native still |
| Compress before upload? | Yes, one JPEG 0.92 encode; unused helper does not participate |
| Main-thread processing? | Canvas allocation/draw is on UI thread; toBlob is asynchronous and browser encoder scheduling varies. Encoder wall time is not proof the main thread was blocked throughout |
| Sequential signing / multiple uploads? | Yes, every queued capture waits for previous signature → upload → create; each is a separate Drop |
| Local item before upload? | None; only counters/status |
| Wait for Cloudinary and backend? | Yes for success status; shutter itself remains enabled whenever camera is ready |
| Full refetch after post? | No refetch in the camera callback. Closing mounts a Space page that fetches the full list and waits for Space/members too |
| Download same photo afterward? | Cloudinary derivative is requested on feed mount; no local blob reuse. Actual cache/transfer trace unavailable |
| Expensive transformations on upload? | None specified. Delivery transforms exist; first-derivative generation delay is possible, unmeasured |
| Redundant requests / processing? | Repeated per-photo signatures and full Space data loading; DB N+1 queries; no redundant live pre-upload encoding found |
| Blocking state? | “Adding…” persists through all network stages. Navigation shows “Entering Space…”; no optimistic image. This is perceived blocking even without a disabled shutter |

XHR lacks a timeout and abort handling; `apiRequest` has no configured deadline. A hung request can stall the entire queue. The optional XHR progress callback is not passed by camera. Failures shift away the only queued copy and decrement pending count; there is no retained failed item, retry UI, local preview, or persistent file.

Navigation may leave a JavaScript upload closure running in the same document, but the new page cannot inspect it. Reload/tab death loses in-memory captures; mobile suspension can interrupt progress. It is inaccurate to promise this queue survives navigation or to claim navigation always immediately cancels the request.

Network speed, API hosting cold starts, cross-origin preflights, Cloudinary ingress/derivative latency, device thermals, and camera focus are **unmeasured hypotheses**. For scale only: a 1 MB payload at 1 Mbit/s needs roughly 8 seconds before overhead. There is no evidence yet that OMLU sends that size or sees that throughput.

## G. Root causes ranked by impact

Ranking reflects product impact and evidence, not an invented ranking of milliseconds.

| Rank | Cause, evidence, location | Measured impact | Proposed fix | Expected improvement |
|---:|---|---|---|---|
| 1 | No local preview/optimistic Drop; create response discarded. Camera `processNextInQueue` lines 168–241; Space `fetchSpace` line 40 | All three sequential operations precede success; actual phone seconds unknown | App-level local Drop store, immediate local preview, reconcile returned Memory | Remove network waits from perceived posting path; target insertion <300 ms, still to validate |
| 2 | Video-frame capture limits source quality. Camera `init` line 102, `handleShutter` line 244 | Ideal 2.07 MP if honored; actual size and perceptual delta unknown | Compare native file capture now as experiment; actual still capture in Flutter later | More source detail and access to still-camera processing; device-dependent |
| 3 | Stream can resolve before conditional video mount. Camera lines 118 and 314 | Controlled reproduction: unattached/not ready versus successful mounted control | Attach on video mount and stream availability; ready only after a usable frame | Eliminate this indefinite startup failure, not a guaranteed FPS increase |
| 4 | Failed photo discarded; no durable upload state or idempotency. Camera line 174/catch; Memory schema/create | Controlled failure leaves queue empty; 5 identical API requests created 5 IDs | Durable local draft + retry phases + backend unique client operation ID | Preserve photos; retry without duplicate posts or unnecessary reupload |
| 5 | Entire queued operations serialize. Camera `processNextInQueue` | Controlled call order: sign1 → upload1 → create1 → sign2 → upload2 → create2 | Bounded scheduling, usually 1–2 transfers; prepare signatures per asset without putting them on UI path | Reduce burst head-of-line waiting; no guarantee of faster single upload |
| 6 | Feed serializer performs 3 SELECTs per Memory. Backend `format_memory_out` line 25 | 100 Drops: 308 SELECTs, median 55.288 ms locally; 50 home Drops: 156 SELECTs, 26.901 ms | Batch aggregates/viewer-like lookup, maintain authorization; cursor pagination | Query count roughly constant per page instead of 3N; greatest benefit when DB RTT/load is higher |
| 7 | Space load gates display on three requests; remote image replaces nonexistent local preview. Space lines 42–50; Carousel | 3-request barrier source-confirmed; phone/decode cost unknown | Merge pending/confirmed state; fetch members independently; retain local preview through remote decode | Avoid post-completion full-page wait and image flash |
| 8 | Canvas work precedes paint; readiness too early; timeout/status handling incomplete. Camera shutter/metadata; upload helper | draw/encode/paint milliseconds unmeasured; no explicit timeout; old 2.5 s success timer may reset a later upload's state | First-frame guard, feedback/preview measurement, staged processing if trace warrants, per-Drop status/deadlines | More reliable feedback and bounded recoverable stalls; validate on phones |

A related API integrity issue is **not a measured latency cause**: `MediaItemCreate` accepts arbitrary asset identifiers, URL strings, dimensions, and bytes; creation does not verify ownership/existence. This must be corrected before making retries/upload sessions a shared contract. Blind trust can also create broken images that look like loading failures.

## H. Quick wins

1. Fix stream-to-video attachment and usable-frame readiness without changing camera choice.
2. Replace the global status/counter illusion with local captured previews and truthful per-Drop pending/failed states. Reuse the existing feed presentation; no redesign required.
3. Preserve failed blobs and uploaded-asset receipts. Add timeout/abort outcomes and manual retry. Do not enable automatic creation retries before backend idempotency.
4. Use the returned `MemoryOut` to reconcile local state; stop requiring full feed reload before a new Drop can appear. Fetch member lists separately from photo display.
5. Batch feed counts and viewer-like checks. Do not attempt concurrent SQL operations on one AsyncSession as a shortcut.
6. Correct stale README claims and the “captured” count, which currently counts completed posts. Make completion timers specific to the item they describe.

Increasing JPEG compression or changing Cloudinary providers is not an evidence-backed first fix.

## I. Changes required before Flutter

Keep one API and one authorization/data model. Add only the capabilities needed by both clients:

- **Idempotent creation:** a stable client-generated UUID per Drop, stored with a unique `(author_id, client_drop_id)` constraint. Same ID + same normalized request returns the same Memory; same ID + different request returns a conflict. Resolve concurrent requests transactionally. Expose a lookup/reconciliation path for timeout-after-commit.
- **Minimal upload sessions:** bind session/media IDs to user, Space, expected count/order, intended public IDs, allowed content/size, expiry, and status. A retry reuses the logical session and refreshes expired signing parameters safely. Do not simply cache one signature/public ID for multiple photos.
- **Verified finalization:** verify Cloudinary response signature and session/public-ID binding; independently verify authoritative metadata where the response signature does not cover it, using provider lookup or verified webhook. Derive trusted URLs; do not trust arbitrary client URLs. Persist receipts so a successful upload need not repeat when create fails. Cloudinary documents [response and upload signature semantics](https://cloudinary.com/documentation/signatures).
- **Atomic multiple-image creation:** retain 1–10 ordered assets, allow individual asset retry, and finalize only the chosen complete set. Explicitly define cancel/remove behavior and orphan cleanup.
- **Stable metadata:** require positive verified width/height for new assets; expose bytes/format/aspect through responses. Add capture time with timezone semantics if event-date accuracy matters offline.
- **Pagination and cheap serialization:** cursor pagination with stable tie-breaker and bounded note payloads; no per-Memory count queries.
- **Auth lifecycle:** current API is reusable bearer JWT, but has no refresh-token route; implement/document expiry and reauthentication before long-lived mobile retry. Keep drafts bound to their author; never retry under a different account.

Do not need a separate Flutter backend, a new media proxy, a general job orchestration platform, or a server-side “pending Memory” for every local-only draft. Local draft status and server upload-session status are distinct.

**Future presentation schema:** current Media already stores the uncropped uploaded asset URL/public ID, dimensions, and order; delivery cropping does not modify that stored master. There is no presentation field. Minimal future migration: one validated, versioned `presentation` JSONB field on Memory (Drop-level default), nullable/backfilled to `{version:1, shape:'original'}`; include optional aspect ratio, normalized focal point, and normalized crop rectangle. Add per-Media overrides only if product requires mixed presentations. Allow `original/square/portrait/landscape/circle` plus a versioned extension scheme. Shape/crop changes must change display metadata only, never overwrite the master. Existing photos need a legacy display policy to avoid silently changing layout; nullable dimensions need backfill or graceful fallback. No migration is necessary merely to start native-camera prototyping, and no presentation migration was implemented.

## J. Things that should wait for Flutter

Native camera lifecycle, focus/exposure controls, sensor still capture, richer haptics, OS-managed background transfers, native thumbnail/decode cache tuning, and 60/120 Hz profiling belong in the mobile implementation. Do not build them into speculative web abstractions now.

Masonry/photo-wall layout and playful shape UI should wait for an explicit presentation task. Keep only the compatible metadata direction. Defer HEIC/AVIF upload adoption, eager Cloudinary variant generation, and complex processing workers until device/traffic measurements justify them.

## K. Recommended optimized pipeline and image strategy

**Proposed targets, not achieved measurements:** shutter feedback <100 ms; low-cost local preview <200 ms; optimistic Space item <300 ms. These budgets are from a ready camera, exclude a first permission prompt, and must be assessed at p95 on agreed devices. Native high-quality still completion may lag the preview; do not hold the preview for the full-size file.

`shutter → feedback + local preview → client UUID + durable draft → pending Drop in shared Space state → background processing/signing/upload → idempotent create → reconcile same item`

Persist source bytes/file and draft metadata as soon as available. If the immediate UI item precedes durable file storage, label it internally as “saving locally”; do not claim offline safety until the transaction/file write succeeds. Web uses IndexedDB blobs with quota/error handling; Flutter uses app-owned files plus a transactional queue store. Object URLs are previews, not persistence. Revoke them only when no view/retry needs them.

Suggested state machine: `capturing → saving_local → queued → processing → uploading → finalizing → confirmed`, with recoverable `failed` and explicit `cancelled`. Keep the local photo on every failure. Offer a subtle pending mark, concise failed state, and retry. Retry the failed phase only. Back off transient network/5xx failures with jitter; pause on auth/permission errors; do not endlessly retry invalid data or full storage.

The pending item must exist in the shared Space store even if the camera stays open for rapid capture. Returning to Space renders it without waiting for server refetch. On confirmation merge by client ID, preserving visual position and local image until the CDN version has decoded. A cold Space route must be able to render pending state independently of members metadata.

### Image policy

| Layer | Starting recommendation, subject to visual/device testing |
|---|---|
| Capture | Native still around ordinary 12 MP class where supported; preserve sensor aspect ratio. Avoid maximum 48/200 MP by default. Keep video preview at a separately tuned resolution/frame rate |
| Existing web capture | Retain intrinsic stream dimensions; do not upscale or further compress the already 1080p-class JPEG just to make it smaller |
| Ordinary upload master | For higher-resolution inputs, an uncropped 2560–3072 px long-edge, orientation-normalized JPEG around 0.90–0.94 is a starting point; encode once, inspect faces/text/foliage/low-light detail |
| Byte budget | Aim roughly 0.7–3 MB for ordinary photos, content-dependent; do not force every scene under a hard small limit by destroying quality |
| Feed variants | Long-edge bounds around 640 / 1080 / 1440; select from actual cell size × DPR and cap at master dimensions |
| Grid thumbnails | Approximately 320 / 480 / 640 px variants depending on cell size and DPR; existing 400-square derivative is a reasonable starting size but not universal |
| Preview | Small local thumbnail or captured frame; never wait for CDN or full master decode |
| Format | JPEG baseline for uploads; provider-negotiated WebP/AVIF delivery where supported. Preserve transparency if gallery inputs are later permitted; JPEG requires an explicit background policy |
| Cloudinary | Master unchanged by display choices; bounded `c_limit,w_…,h_…`, `f_auto,q_auto:good` candidates for feed, `c_fill` only for chosen crops. Current feed only limits width; also bounding height handles very tall photos |
| Cache | Stable versioned URLs, shared transformation definitions, CDN/browser caching verified from actual headers; persistent mobile disk cache bounded by bytes and decoded-image cache bounded by memory |

Cloudinary's resize/format/quality transformations act on delivery derivatives; they cannot reduce a file that has already been uploaded. First transformation generation may add latency; use a local preview first and only consider pre-generating a small fixed thumbnail set after measurement. See [Cloudinary image optimization](https://cloudinary.com/documentation/image_optimization).

**Original preservation needs precise terminology:** a 3072-pixel master preserves composition and useful detail but is not the byte-for-byte/full-resolution source. If OMLU promises the actual original, retain that source locally and archive it separately in the background under an explicit connectivity/storage policy. A 10–20 MB original cannot be stored remotely without transferring those bytes eventually. Do not delete the source before the required archival confirmation. If the product instead keeps only a normalized high-quality master, say so; never call it the untouched original. In either policy, shape/crop metadata must never destroy the preserved master.

## L. Flutter architecture recommendation

One thin native client of the existing FastAPI API:

`camera + thumbnail adapter → local draft repository → upload coordinator → OMLU API / signed Cloudinary transfer`

`Space repository → local pending + server-confirmed items → existing product presentation`

- Keep camera preview on its native texture path; no per-frame image copies into Dart just to show preview. Use native still capture for the saved photo and a fast preview for immediate UI feedback.
- Keep I/O asynchronous; send substantial resize/encode CPU work off the UI isolate/native UI thread. An isolate alone is not a guarantee that work continues when the OS suspends the app. Use OS-supported transfer scheduling when background completion is required; reconcile on resume. See [Flutter isolates](https://docs.flutter.dev/perf/isolates) and [background processes](https://docs.flutter.dev/packages-and-plugins/background-processes).
- Persist queue state and app-owned source files, upload receipts, client ID, retry count, and next-attempt time. Recover after process death, not just widget navigation. Avoid storing only temporary camera file paths that the OS may remove.
- Target 16.7 ms frame intervals at 60 Hz and 8.3 ms at 120 Hz; profile UI and raster work on real devices in profile/release-like builds. Use lazy lists/slivers, small reactive rebuild regions, stable keys, and bounded prefetch. Avoid costly clipping/offscreen layers in every photo cell. [Flutter performance guidance](https://docs.flutter.dev/perf/best-practices).
- Fetch thumbnails first and decode near physical cell dimensions using `cacheWidth`/`cacheHeight`; request a larger asset only for detail/zoom. `Image.file` documents decode-size controls in [the Flutter API](https://api.flutter.dev/flutter/widgets/Image/Image.file.html). A 12 MP RGBA decode is roughly 46 MiB before overhead; many such feed cells are not viable.
- Use width-based layouts for small phones, large phones, and tablets; preserve measured aspect ratios to reserve layout space. Implement lazy masonry only when the presentation task is approved. Paginate in the repository regardless of layout.
- Apply supported haptics at shutter/success where appropriate, with visual feedback as the reliable fallback. Release camera resources on background and restore intentionally.

Concrete capabilities needed later: native camera bridge, durable local store, HTTP upload progress/cancellation, secure token storage, and OS background-transfer integration if required. Choose packages during implementation based on those needs; no extra state-management/cache/masonry dependency is justified merely by this audit.

## M. Existing backend/API reuse plan

Retain `/api/v1` FastAPI routes for auth, Spaces, membership, Memories, comments, likes, notes, and activity; retain PostgreSQL, Alembic, server authorization, and Cloudinary signing. Flutter sends the same bearer-authenticated JSON and uploads binaries directly to Cloudinary. Next.js remains another API client.

Centralize membership rechecks, signature rules, upload ownership verification, canonical asset metadata, atomic creation, idempotency, and presentation validation server-side. Keep immediate UI feedback, local persistence, device camera choice, draft thumbnails, and retry scheduling client-side. Publish a versioned OpenAPI contract and shared test vectors for both clients rather than duplicating Python rules in Dart.

Existing `MemoryOut` is already rich enough for reconciliation; add the client correlation ID and trustworthy asset metadata. Maintain compatibility for existing clients during migration. An additive upload-session endpoint can coexist with the current signer during rollout. The current simple signer is not itself an upload-session protocol.

Private Space authorization protects API listings, but the code uses standard public Cloudinary `image/upload` delivery URLs. It does not demonstrate private/authenticated media delivery. Decide whether possession of an unguessable URL is acceptable or authenticated delivery is required before expanding caching/sharing; this is an existing architecture property, not an observed leak.

## N. Risks / edge cases

- Camera permission denied/revoked, already-granted permission triggering the attachment race, wrong actual lens despite ideal facing mode, zero-dimension/black first frame, background interruption, orientation change, and rapid flips.
- Multiple overlapping `toBlob` callbacks may enqueue in completion order rather than shutter order; capture UUID/time/sequence must be assigned at shutter.
- Slow upload blocks all following captures; burst buffers have no bound. Limit memory and persist rather than retaining unlimited canvases/blobs.
- Close-to-Space before backend confirmation can show a stale feed indefinitely. App navigation may preserve an upload closure; refresh cannot preserve the photo today.
- Timeout after commit versus before commit; lost Cloudinary response versus failed upload; retry with expired signature; orphaned uploaded asset; multi-photo partial completion; duplicate taps/concurrent retries.
- Removal from Space between signing and finalization, logout/account switch, token expiry, cancellation during retry, and later permission loss for cached private media.
- Offline timestamps crossing midnight/timezones. Current server default records UTC processing date, not original capture date.
- HEIC/HDR/wide-gamut inputs and EXIF orientation for a future picker; GPS metadata removal must not accidentally rotate images or discard a promised original.
- Browser storage quota/eviction, OS temporary-file cleanup, app termination and constrained background execution. Pending UI must not imply persistence that failed.
- Cold CDN variants, high-DPR tablets, tall panoramas, decode memory pressure, and cache eviction; cropped thumbnails are not archival originals.
- The schema has nullable/unverified dimensions and no uniqueness on Cloudinary asset binding. Future session validation must avoid attaching another user's asset or reusing one accidentally.
- Local backend timings omit durable commit, WAN/hosting load and populated social data. Do not use them as launch SLOs.

## O. Exact implementation plan in dependency order

1. **Capture a real baseline:** run the opt-in browser probe on iOS/Android with staging uploads and remote network/performance traces; add temporary server-stage spans. Record actual dimensions/bytes, first-frame, feedback/preview paint, encoding, queue wait, signature, upload, create, and final image paint. Remove hooks afterward. This is necessary to claim the exact cause of 6–15 seconds, but does not block fixing proven defects.
2. **Repair camera lifecycle:** attach on mount/stream arrival; wait for usable frame/playback; handle stream interruption, null canvas/blob, and camera switching. Keep current camera technology and feed layout. Add a focused regression for permission resolving before Space/auth.
3. **Make creation retry-safe:** additive client UUID/request identity migration and API contract, race-safe uniqueness, conflict semantics, reconciliation lookup, and authorization tests. Define canonical payload identity before making retries automatic.
4. **Bind and verify uploads:** minimal upload session/asset receipt contract with expiry, ordering, authoritative metadata and ownership checks. Test forged/mismatched assets and successful upload followed by failed finalization. No generic orchestration rewrite.
5. **Add durable local drafts and a shared upload coordinator:** persist photo bytes, timestamps and per-phase state; retain failures; timeout/abort handling; per-asset retry; bounded concurrency; account/Space isolation; recovery after refresh/process death.
6. **Add immediate preview and optimistic insertion:** reuse current MemoryCard/grid presentation, show subtle pending/failed state, reconcile by client UUID with `MemoryOut`, retain local image until confirmed derivative decode. Stop coupling photo display to members/full-list reload.
7. **Remove server feed N+1 work:** batch likes/comment counts and viewer-liked flags, introduce compatible cursor pagination and bounded notes; preserve membership/privacy behavior and verify constant-per-page query growth.
8. **Tune image policy using the captured evidence:** avoid re-encoding the current small camera JPEG; compare high-quality uncropped master settings on representative native files. Make original archival policy explicit. Trial system capture separately only when requested.
9. **Validate acceptance on phones:** <100/<200/<300 ms perceived targets, no lost photo during offline/failure/reload, no duplicate Drop on retry, correct orientation/aspect, bounded burst memory, and no first-render dependency on network completion. Report SLO distributions, not a single best run.
10. **Then prepare Flutter:** document/version the shared API and auth lifecycle; implement a focused native camera/draft/upload/feed client in a later task. Presentation metadata migration and shape/masonry UI remain separate work.

### READY TO IMPLEMENT: YES

Ready for the bounded fixes supported by this audit. This does **not** mean the real-phone timing audit is complete or that Cloudinary has been proved to cause the reported delay.

**Exactly what to request in the NEXT prompt:** implement steps 2–7 as one staged reliability/optimistic-posting change: camera attachment/first-frame repair; idempotent creation; minimal verified upload sessions; persistent per-Drop drafts and retry coordinator; local preview/optimistic insertion using the existing presentation; create-response reconciliation; and batched feed aggregates/pagination. First collect the device baseline from step 1 if a test session is available. Include focused regressions for camera mount order, offline retention/reload, upload-success/create-failure, timeout-after-commit, duplicate/concurrent retries, revoked membership, multi-image partial failure, and feed query growth. Preserve current capture technology, image quality, and feed design. Do not create Flutter, add shapes, commit, push, or deploy.

### Audit artifacts and verification

Only `docs/audits/photo-pipeline/` was added. Production frontend/backend files remain unchanged. The backend probe succeeded and verified schema rollback; camera control probe assertions passed; browser snippet passed `node --check` but has not been phone-validated. No live Cloudinary upload, permanent Memory, or new user account was created. The existing broad test suite was not run against the user's database.

- [Backend diagnostic](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/backend_probe.py) / [raw results](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/backend-results.json)
- [Camera control diagnostic](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/camera_control_probe.cjs) / [raw results](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/camera-control-results.json)
- [Opt-in device probe](/Users/kailasanadhg/Documents/Omlu/docs/audits/photo-pipeline/browser_probe.js)
