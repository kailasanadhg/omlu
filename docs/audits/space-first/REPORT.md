# OMLU Space-first implementation and deployment report

Status: implemented and verified locally; not deployed. Production account data has not been inspected or modified. Full acceptance still needs authenticated production verification and the Cloudinary confidentiality work below.

## Audit and root causes

- Architecture: Next.js 16.3.6 App Router/React 19 web, FastAPI + async SQLAlchemy/PostgreSQL backend, Alembic, direct signed Cloudinary uploads, IndexedDB upload queue. Flutter is another consumer of the same API. No framework or state-management replacement.
- Global feed: Home explicitly called `/memories/feed` and mapped a full `MemoryCard` for every unrelated Space. Space pages defaulted to the same feed. Root `<main>` and top navigation used `max-w-xl`; the grid cropped all images square.
- Shell with absent/misleading content: root layout correctly renders `{children}`. Navigation renders independently from page requests. Home caught errors only in the console; Promise.all discarded successful Space data when the feed failed. Spaces also swallowed errors and displayed “No Spaces yet.” Profile treated every failure as a nonexistent user. No route error boundary existed. Requests lacked a timeout.
- Authentication: `/auth/me` deleted the token on every exception, including temporary network and server failures. This could redirect users or clear page state without explaining the outage.
- Production read-only probe: homepage and `/health` returned HTTP 200; deployed JS embeds `https://omlu-core.onrender.com/api/v1`. CORS preflight accepted `https://omlu.in`. Thus a wrong API URL or CORS failure is **not established as the current production cause**. Live OpenAPI lacks visibility and live Home still calls `memories/feed`. A health response does not query the database. No production token/log/database access was available, so the exact failing authenticated request or migration drift remains unproven.
- Relationships: `memories.space_id → spaces.id`, `memories.author_id → users.id`, `media.memory_id → memories.id`; memberships enforce unique `(user_id, space_id)`. Ownership is distinct from membership. The repository has owner/member roles, no admin role.
- Previous profile privacy was shared-membership based, including all own private contributions for self. This differed from the requested public-only profile contract.
- Images: public Cloudinary upload URLs, existing URL transformations, eager metadata plus lazy image elements. Grid transformation cropped 400px squares. Existing originals are public CDN assets; signed upload permission is not signed delivery permission.
- Pagination/performance: feed bounded at 50, Space silently capped at 100, profile unbounded; no web continuation UI. Space list issued two extra count queries per Space. Memory reaction counts were already batched; eager relationship loading already avoided per-memory author/media queries.

## Implementation

1. Add `spaces.visibility` with database check and private server default. Add only collection-order indexes matching Space and author queries. All IDs, records, invite codes, media URLs and foreign keys remain intact.
2. Anonymous public reads for Space, memory, notes/comments, public user profile and profile memories. Private reads require membership. Public Space output redacts invite codes from nonmembers. Upload, like, note/comment creation, member listing and moderation retain separate authorization. Only owners can change visibility via `PATCH /spaces/{id}`. Unknown visibility values fail schema validation.
3. Public profile counts and contributions filter `Space.visibility == 'public'` in SQL, including for self/shared members. Notifications from Spaces the recipient has left no longer disclose private note content.
4. Home is the Space directory. Space and profile collections share a lightweight CSS masonry renderer, not a global feed. Desktop canvas up to 1600px; 2/3/4/5/6 columns across breakpoints. Native dialog provides focus containment, Escape closing, focus restoration, and scroll lock. Detail retains uploader, originating Space, notes, dates, reactions, photo carousel, and actions. Public readers cannot activate member-only like/note writes.
5. Existing upload/reconciliation queue remains in use and initializes after authentication; pending memories remain scoped to their Space. Route identity keys prevent old profile/Space state surviving navigation or account changes.
6. Web collections request 30 at a time, with explicit Load more (no runaway infinite fetch). Server supports stable date/time/UUID cursors scoped to the authorized collection; rejects foreign cursors. Legacy default batch remains 100. Returned arrays remain compatible with existing clients.
7. Grid Cloudinary derivatives preserve ratio, use 320/640/960 responsive candidates, lazy loading and reserved dimensions. Extreme ratios are bounded with contain rather than destructive cropping; one failed/missing asset has its own fallback. Larger image is requested only in detail. Non-Cloudinary URLs remain compatible and cannot automatically be optimized.
8. API origin normalization, production fallback, request timeout, auth-scoped in-flight GET deduplication (not persistent private caching), useful HTTP/network/invalid JSON errors, 401 session invalidation, transient-auth retry without token loss, meaningful loading/error/empty states and retry. Root route error boundary uses this installed Next version's `retry` API. CORS defaults explicitly allow production origins instead of wildcard credentials.

## Migration

`backend/alembic/versions/c24a91d8e602_space_visibility.py`, after `b13e7a2f901c`:

- Adds non-null `visibility VARCHAR(7) DEFAULT 'private'` and `ck_space_visibility`.
- Adds `(space_id, memory_date, created_at, id)` and `(author_id, memory_date, created_at, id)` indexes.
- Never recreates application tables or reseeds users/Spaces/memories.
- Downgrade drops only the new indexes/constraint/column. Downgrading necessarily loses visibility choices; do not use it casually.
- Index creation uses ordinary transactional Alembic DDL. Schedule an appropriate deployment window for large production tables and check locking impact on staging.

## Validation

Local isolated PostgreSQL on port 55439, database `omlu_space_test`; never production:

- Full migration chain: upgrade to `c24a91d8e602` succeeded. `alembic check` reports no new upgrade operations (models and migrated schema match).
- Full backend pytest suite: **21 passed** (18 existing/adjusted plus 3 new tests). New migration test runs upgrade/downgrade on populated temporary-schema tables and proves Space ID, memory ID, author and association retention. Authorization tests cover public/private reads, owner and member behavior, profile filtering, writes, visibility change and paging isolation.
- Existing frontend client suite: **9 checks passed**.
- New real Chromium browser suite against local production build: successful Space data rendering, loading, empty, API failure/retry, single directory request, responsive columns/no overflow, failed-image isolation, pagination, keyboard dialog/focus return, profile API contract, transient auth token preservation/recovery; **passed, no page runtime errors**. Browser API fixtures live only in the test script, never in application code. Backend tests separately prove database filtering; browser fixtures do not establish production data availability.
- TypeScript: passed.
- ESLint: **0 errors, 7 image-element warnings**. Images use existing Cloudinary delivery rather than Next's proxy; remaining warnings include existing camera/avatar/invite components.
- Production build: `npm run build -- --webpack` passed (all 13 routes). Default Turbopack build failed because its CSS worker could not bind a local port, including an escalated retry; webpack is the supported successful fallback, not a code compile workaround.
- `git diff --check`: passed.

Reproduce backend checks with a disposable database only:

```sh
cd backend
export DATABASE_URL=postgresql+asyncpg://127.0.0.1:55439/omlu_space_test
export SYNC_DATABASE_URL=postgresql://127.0.0.1:55439/omlu_space_test
venv/bin/alembic upgrade head
venv/bin/pytest -q app/tests
```

Frontend:

```sh
cd frontend
npm test
npm run lint
npx --no-install tsc --noEmit
npm run build -- --webpack
npm run start -- --port 3107
# In another terminal, with Playwright and its matching Chromium available:
TEST_FRONTEND_URL=http://localhost:3107 npm run test:browser
# PLAYWRIGHT_MODULE can point to an existing Playwright installation.
```

## Remaining issues / limits

- **Cloudinary asset confidentiality remains incomplete.** Existing `image/upload` URLs are publicly retrievable if copied, including after a Space becomes private. New uploads still use that existing delivery contract to preserve native/web compatibility. API filtering prevents unauthorized discovery; it does not revoke public CDN delivery. Completing asset privacy requires an authenticated-delivery migration, authorized expiring delivery URLs or a media gateway, adapting web/native transformations and upload verification, and invalidating old public CDN originals/derivatives. Do not promise strict private asset protection until that migration is verified. No Cloudinary account mutations were performed.
- No authenticated production data read was possible: actual existing account Spaces/memories and database revision still need the checks below. No production data has been reset/reseeded or mutated.
- Native Flutter UI has not been redesigned. Existing routes and response-array shape remain; native consumers retain the historical 100-item Space default and need cursor adoption to browse larger collections. Public profile semantics intentionally change for all clients to public-only.
- Space directory and people lists are still unpaginated; memory collections, the dominant photo payload, are bounded. Existing notes on each memory are still included for compatibility.
- No supplied Pinterest screenshot was attached; implementation follows the brief's described density/layout without copying branding.

## Render actions

1. Back up production PostgreSQL using the provider's supported snapshot workflow. Record current Alembic revision, table counts and stable ID/relationship checksums before migration; test upgrade on a restored staging backup first.
2. Confirm `DATABASE_URL` (asyncpg) and `SYNC_DATABASE_URL` target the same production database; retain `SECRET_KEY` so existing JWT sessions continue working. Keep existing Cloudinary credentials.
3. Set `FRONTEND_URL=https://omlu.in`, `BACKEND_URL=https://omlu-core.onrender.com`, and `BACKEND_CORS_ORIGINS=["https://omlu.in","https://www.omlu.in"]` plus deliberately authorized preview/native web origins if needed.
4. Release command: `alembic upgrade head`; then start `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"`. Migration must precede new API traffic because the ORM now selects visibility.
5. Verify `alembic current` reports `c24a91d8e602`. Compare unchanged application-table counts/IDs and associations. All existing Spaces should be private. Owners must explicitly publish any chosen Spaces.

## Vercel actions

1. Set `NEXT_PUBLIC_API_URL=https://omlu-core.onrender.com/api/v1` for the production environment and rebuild (it is compiled into browser JS).
2. Deploy backend/migration first, frontend second. Standard `npm run build`; if the deployment environment reproduces the local Turbopack restriction, use `npm run build -- --webpack`.
3. Verify served JS/API responses are the new deployment. Test an existing signed-in session and a fresh sign-in; hard reload to exclude stale browser assets.

## Exact production verification

Read-only unauthenticated checks:

```sh
curl --fail-with-body https://omlu-core.onrender.com/health
curl --fail-with-body https://omlu-core.onrender.com/openapi.json
curl -i -X OPTIONS https://omlu-core.onrender.com/api/v1/spaces \
  -H 'Origin: https://omlu.in' -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
```

Using an existing member token locally (do not paste it into reports), set `OMLU_TOKEN`, `PRIVATE_SPACE_ID`, `PUBLIC_SPACE_ID`, `PRIVATE_MEMORY_ID`, `PUBLIC_MEMORY_ID`, `CONTRIBUTOR_ID`, `USERNAME`:

```sh
curl --fail-with-body -H "Authorization: Bearer $OMLU_TOKEN" https://omlu-core.onrender.com/api/v1/spaces
curl --fail-with-body -H "Authorization: Bearer $OMLU_TOKEN" "https://omlu-core.onrender.com/api/v1/memories/space/$PRIVATE_SPACE_ID?limit=30"
curl --fail-with-body -H "Authorization: Bearer $OMLU_TOKEN" "https://omlu-core.onrender.com/api/v1/memories/$PRIVATE_MEMORY_ID"
curl -i "https://omlu-core.onrender.com/api/v1/spaces/$PRIVATE_SPACE_ID"
curl -i "https://omlu-core.onrender.com/api/v1/memories/$PRIVATE_MEMORY_ID"
curl --fail-with-body "https://omlu-core.onrender.com/api/v1/spaces/$PUBLIC_SPACE_ID"
curl --fail-with-body "https://omlu-core.onrender.com/api/v1/memories/$PUBLIC_MEMORY_ID"
curl --fail-with-body "https://omlu-core.onrender.com/api/v1/users/@$USERNAME"
curl --fail-with-body "https://omlu-core.onrender.com/api/v1/memories/user/$CONTRIBUTOR_ID?limit=30"
```

Private anonymous requests must return 403; authorized member reads must return the original records. Public responses must exclude private IDs/URLs and nonmember invite codes. Continue with `&before=<last-memory-id>` and verify no repeated IDs or cross-Space content. On an authorized staging/test Space, check nonmember upload/like/comment/note/visibility attempts return 403; owner visibility changes should change anonymous reads and public-profile results immediately.

In the browser, verify a known existing Space and memory (not just an empty state), desktop 1440px, mobile 390px, pagination, Escape/focus behavior, a failed image, offline/retry, and expired-session sign-in. Confirm no request failures in Network or runtime errors in Console. Check copied private asset URLs separately; they will remain retrievable until the Cloudinary migration above is completed.

## Changed files
- `README.md`
- `backend/alembic/versions/c24a91d8e602_space_visibility.py`
- `backend/app/api/deps.py`
- `backend/app/api/v1/activity.py`
- `backend/app/api/v1/comments.py`
- `backend/app/api/v1/memories.py`
- `backend/app/api/v1/notes.py`
- `backend/app/api/v1/spaces.py`
- `backend/app/api/v1/users.py`
- `backend/app/core/config.py`
- `backend/app/models/memory.py`
- `backend/app/models/space.py`
- `backend/app/schemas/memory.py`
- `backend/app/schemas/space.py`
- `backend/app/tests/test_authorization.py`
- `backend/app/tests/test_visibility.py`
- `backend/app/tests/test_visibility_migration.py`
- `docs/audits/space-first/REPORT.md`
- `frontend/package.json`
- `frontend/src/app/error.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/spaces/[id]/page.tsx`
- `frontend/src/app/spaces/new/page.tsx`
- `frontend/src/app/spaces/page.tsx`
- `frontend/src/app/u/[username]/page.tsx`
- `frontend/src/components/feed/Carousel.tsx`
- `frontend/src/components/feed/MemoryCard.tsx`
- `frontend/src/components/modals/CommentSheet.tsx`
- `frontend/src/components/navigation/BottomNav.tsx`
- `frontend/src/components/navigation/TopBar.tsx`
- `frontend/src/components/space/LoadMoreMemories.tsx`
- `frontend/src/components/space/MemoriesGrid.tsx`
- `frontend/src/components/space/SpaceHeader.tsx`
- `frontend/src/components/ui/LoadState.tsx`
- `frontend/src/components/ui/MemoryImage.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.tsx`
- `frontend/src/lib/cloudinary.ts`
- `frontend/src/types/index.ts`
- `frontend/tests/space_first_browser.cjs`
