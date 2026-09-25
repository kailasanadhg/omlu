# OMLU — Our Memories Link Us

Current implementation: **Space → People → Memories**. Web Home is a Space directory; collections use responsive masonry. Space visibility defaults to private, and public profiles contain only public-Space contributions. See [the Space-first implementation and deployment report](docs/audits/space-first/REPORT.md) for current migration, verification results, rollout steps, and the unresolved Cloudinary asset-delivery limitation. The original implementation notes below describe the earlier MVP and are superseded by that report where they differ.

A shared social memory platform where groups create private **Spaces** to share collective photo memories.
The core paradigm is **People → Spaces → Memories**.

---

## 1. Architecture Summary

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, PWA support (`manifest.json`, standalone viewport, safe-area-inset padding), Lucide React, and `qrcode.react`.
- **Backend**: FastAPI, Python 3.12, async SQLAlchemy 2.0, Alembic migrations, PostgreSQL 15, JWT authentication with bcrypt password hashing.
- **Media & Storage**: Cloudinary zero-proxy direct browser uploads via server-authorized HMAC signatures (`POST /api/v1/media/cloudinary-sign`), client-side HTML5 Canvas EXIF/GPS stripping & downsampling (<2048px), and dynamic on-the-fly URL transformations (feed, 3-column grid, avatar, cover).
- **Privacy & Security**: Server-enforced boundary authorization. Memories and membership are strictly private to members. Profile views are filtered exclusively to shared Spaces between the viewer and profile owner (CRITICAL PRIVACY RULE).

---

## 2. Implemented Feature List

1. **Authentication & Identity**:
   - Secure email, password (bcrypt), and normalized `@username` signup and login.
   - Case-insensitive uniqueness enforcement for emails and usernames.
   - Blocklist of reserved system usernames (`admin`, `omlu`, `api`, etc.).
   - Profile management: display name, username change, bio, and Cloudinary avatar uploads.
2. **Private Spaces**:
   - Create private invite-only Spaces with title, description, and cover image.
   - Automatic owner assignment upon creation.
   - Cryptographically safe 12-character URL-safe invite codes.
   - High-contrast, scannable, and printable QR codes (`QRCodeSVG`) for poster or device display.
   - Instant invite preview endpoint with member/memory counts without leaking private content.
   - Seamless QR scan-to-join onboarding preserving destination across login/signup (`/join/[code]`).
3. **Space Management & Moderation**:
   - View members with subtle "Owner" badges.
   - Space owners can remove members or delete any memory posted in their Space.
   - Members can leave Spaces.
4. **Memories & Media**:
   - Multi-photo posts (1–10 photos per Memory).
   - Client-side Canvas EXIF/GPS stripping and <2048px optimization before upload.
   - Direct browser-to-Cloudinary upload with real-time percentage progress bar.
   - Distinction between `created_at` (uploaded to OMLU) and `memory_date` (when the event actually happened).
   - Photo carousel with touch-swipe gestures, indicator dots, image counter, and double-tap heart like animation.
   - 3-column photo grid view with full detail modal.
5. **Social Interactions**:
   - Like toggle with instant responsive feedback and duplicate prevention.
   - Comments sheet drawer with instant post and author/space-owner deletion.
   - Activity notifications feed for likes, comments, and new space members.
6. **Privacy Enforcement**:
   - Visiting a user's profile displays only memories from Spaces that *both* the viewer and the profile owner belong to.
   - Unauthorized API requests return `403 Forbidden`.

---

## 3. Database & Migration Status

PostgreSQL schema managed with SQLAlchemy 2.0 and Alembic:
- `users`: User identity, credentials, avatar, bio, timestamps.
- `spaces`: Name, description, cover, owner foreign key, unique invite code.
- `memberships`: Unique `(user_id, space_id)` pairs with `role` (`owner` / `member`).
- `memories`: Author, space, caption, `memory_date` (event date), `created_at` (upload date).
- `media`: Cloudinary public ID, secure URL, dimensions, format, bytes, position index.
- `likes`: Unique `(user_id, memory_id)` constraint.
- `comments`: Comment body, author, memory relation.
- `notifications`: Actor, recipient, event type, content, read status.

Current status: **Fully migrated to head (`92430cb1d2a2_initial_omlu_schema`)**.

---

## 4. Required Environment Variables

Copy `.env.example` to `backend/.env`:
```ini
# Backend Settings
PROJECT_NAME="OMLU"
SECRET_KEY="generate-a-secure-random-key"
ACCESS_TOKEN_EXPIRE_MINUTES=20160

# Database
DATABASE_URL="postgresql+asyncpg://localhost:5432/omlu"
SYNC_DATABASE_URL="postgresql://localhost:5432/omlu"

# Cloudinary (Free account at https://cloudinary.com)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# URLs
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
```

Frontend (`frontend/.env.local` optional):
```ini
NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
```

---

## 5. Local Development Commands

### Prerequisites
- Node.js >= 20
- Python >= 3.11
- PostgreSQL running locally

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:3000`.

---

## 6. Production Build & Test Commands

### Run Backend Tests & E2E Verification
```bash
cd backend
source venv/bin/activate
pytest -v app/tests
python scripts/verify_e2e.py
```

### Run Frontend Lint & Build
```bash
cd frontend
npm run lint
npm run build
```

---

## 7. Deployment Instructions

1. **Database**: Provision a managed PostgreSQL instance (e.g. Supabase, Neon, AWS RDS).
2. **Backend**:
   - Deploy as a Docker container or on Render/Railway/Fly.io.
   - Set environment variables: `DATABASE_URL`, `SYNC_DATABASE_URL`, `SECRET_KEY`, `CLOUDINARY_*`.
   - Run release command: `alembic upgrade head`.
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. **Frontend**:
   - Deploy on Vercel, Netlify, or Cloudflare Pages.
   - Set environment variable: `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`.

---

## 8. Verification & Test Results

- **Unit & Integration Pytest Suite**: 5 test suites (Auth, Spaces, Memories & Media, Privacy & Authorization, Activity) — **100% Passed**.
- **Critical Path E2E Script (`verify_e2e.py`)**: Full user journey from signup, space creation, QR preview, invite join, Cloudinary signature authorization, multi-photo post, like, comment, strict privacy boundary test, and owner moderation — **100% Passed**.
- **Next.js Production Compilation**: `npm run build` compiled 11 routes successfully with 0 errors.
- **Frontend Code Quality**: `npm run lint` passed with 0 errors.

---

## 9. Known Limitations (MVP Scope)

- **Cloudinary Asset-Level Access**: Cloudinary delivery URLs are served over Cloudinary's global CDN. While the application strictly restricts API discovery of memories to Space members only, anyone who has the raw derived Cloudinary URL directly can load the image file from CDN. (In a subsequent release, Cloudinary authenticated/private delivery types or signed delivery URLs can be configured).
- **Video Support**: The current MVP targets photos (JPEG, PNG, WebP) as specified. Media schema is designed to easily accommodate `resource_type: "video"`.
- **Search**: Discovery is invite-only via QR/URL for privacy; global search is omitted intentionally.

---

## 10. Highest-Priority Issues Before Real Users

1. Configure production Cloudinary account credentials in `backend/.env`.
2. Configure a persistent PostgreSQL database on managed infrastructure.
3. Set a strong random `SECRET_KEY` in production environment variables.

---

## 11. Next Recommended Iterations

1. Add Google One-Tap sign-in alongside email/password (User model is already compatible).
2. Add signed Cloudinary delivery URLs for end-to-end asset confidentiality.
3. Space memory export / download zip album for offline preservation.
