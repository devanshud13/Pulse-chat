# Pulse — Realtime Chat Platform

A production-grade realtime chat platform composed of three independently deployable applications:

| App        | Stack                                                      | Deploys to |
| ---------- | ---------------------------------------------------------- | ---------- |
| `frontend` | Next.js 15, React 19, TypeScript, Tailwind, Framer Motion  | Vercel     |
| `backend`  | Node.js, Express, TypeScript, MongoDB Atlas, Socket.IO     | Render     |
| `extension`| Chrome Manifest V3, Service Worker, Offscreen Doc, Socket.IO | Chrome Web Store |

## Architecture

```
┌──────────────────┐        HTTPS / WSS        ┌──────────────────────┐
│  Next.js (Vercel)│  ───────────────────────► │  Express + Socket.IO │
│  React 19, TS    │                           │  Render web service  │
└────────┬─────────┘                           └──────────┬───────────┘
         │                                                │
         │ postMessage(JWT) ◄──── content.js              │ Mongoose
         │                                                ▼
┌────────▼─────────┐        Socket.IO          ┌──────────────────────┐
│ Chrome Extension │  ───────────────────────► │  MongoDB Atlas       │
│ (Service Worker) │  ─── Cloudinary uploads ──►│  Cloudinary (files)  │
│ + Offscreen doc  │                           │                      │
└──────────────────┘                           └──────────────────────┘
```

## Features

### Authentication
- Email + password signup, login, logout
- JWT access tokens (15m) + rotated refresh tokens (30d)
- Auto-refresh on 401 with axios interceptor; sockets reconnect with fresh tokens

### Chat
- One-to-one and group chats with admins, members, descriptions
- Realtime messaging via Socket.IO rooms (`user:<id>`, `chat:<id>`)
- Typing indicators (debounced), read receipts, online presence, last seen
- Message pagination ("load earlier"), auto-scroll, deletion (soft)
- Image/PDF/Doc/Zip uploads via Cloudinary; metadata persisted in MongoDB

### Notifications
- Per-user notification documents created on each new message
- Realtime delivery to active website tab
- Background Chrome notifications via the extension
- Click → opens `/<frontend>/chat/<chatId>` directly

### Security
- Helmet, compression, morgan, CORS allowlist
- Two rate limiters: general API (300/15m) and auth (20/15m)
- Zod input validation everywhere; bcrypt 12-round password hashing
- Socket auth middleware verifying JWTs on handshake
- File MIME allowlist + 25MB hard limit

## Quick start (local development)

### Prereqs
- Node.js ≥ 18
- A MongoDB Atlas cluster (or any MongoDB 6+)
- A Cloudinary account (for uploads)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, CLOUDINARY_*, CLIENT_URL
npm install --legacy-peer-deps
npm run dev
# → http://localhost:5000
```

> The `--legacy-peer-deps` flag is required because `multer-storage-cloudinary`
> still declares a peer of `cloudinary@^1`, while we use `cloudinary@^2`. The
> runtime APIs are compatible.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
# NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
npm install
npm run dev
# → http://localhost:3000
```

### 3. Chrome extension

```bash
cd extension
# Optional: open utils/config.js and edit DEFAULTS to point to staging/prod.
# (Endpoints can also be changed at runtime from the popup's "Endpoints" panel.)
```

Then load it as an unpacked extension:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` directory
5. Pin the Pulse icon to your toolbar

The extension auto-detects when you log in on the frontend and starts
showing realtime notifications + a badge with your unread count.

## Project layout

```
chat-app/
├── backend/                      # Express + Socket.IO
│   ├── src/
│   │   ├── app.ts               # Entry point + HTTP server bootstrap
│   │   ├── config/              # env, db (Mongo), Cloudinary
│   │   ├── controllers/         # Thin HTTP layer (req/res)
│   │   ├── middleware/          # auth, error, validate, rateLimit, upload
│   │   ├── models/              # User, Chat, Message, Notification
│   │   ├── routes/              # Express routers (mounted under /api/v1)
│   │   ├── services/            # Business logic (auth, chat, message, etc.)
│   │   ├── sockets/             # Socket.IO server + handlers + emitters
│   │   ├── types/               # Shared TS types
│   │   ├── utils/               # logger, ApiError, asyncHandler, jwt
│   │   └── validators/          # Zod schemas
│   ├── render.yaml              # One-click Render deployment
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                     # Next.js App Router
│   ├── app/
│   │   ├── (auth)/login, signup
│   │   ├── (app)/chat, profile, settings, notifications
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/                # Sidebar, ChatWindow, MessageBubble, …
│   │   ├── layout/PageShell.tsx
│   │   └── ui/                  # Shadcn-style primitives
│   ├── hooks/                   # useSocketEvents, useMounted
│   ├── providers/               # ThemeProvider, AuthProvider
│   ├── services/                # api (axios), chat, notification, socket
│   ├── store/                   # Zustand stores (auth, chat)
│   ├── types/
│   ├── utils/
│   ├── vercel.json
│   └── package.json
│
└── extension/                    # Manifest V3
    ├── manifest.json
    ├── background.js            # Service worker (badge, alarms, click router)
    ├── offscreen.html / .js     # Persistent Socket.IO connection
    ├── content.js               # Bridges JWT from frontend tabs
    ├── popup.html / .css / .js  # Toolbar UI
    ├── utils/                   # config, auth, api
    ├── vendor/socket.io.min.js  # Bundled Socket.IO browser client
    ├── icons/                   # 16/32/48/128px PNGs (regenerable)
    └── scripts/build-icons.py
```

## API surface (`/api/v1`)

| Method | Path                              | Auth | Notes                                  |
| ------ | --------------------------------- | ---- | -------------------------------------- |
| GET    | `/health`                         | -    | Render health probe                    |
| POST   | `/auth/signup`                    | -    | `{ name, email, password }`            |
| POST   | `/auth/login`                     | -    | Returns access + refresh tokens        |
| POST   | `/auth/refresh`                   | -    | Rotating refresh tokens                |
| POST   | `/auth/logout`                    | ✓    | Revokes the supplied refresh token     |
| GET    | `/users/me`                       | ✓    | Current user                           |
| PATCH  | `/users/me`                       | ✓    | Update name/bio/avatar                 |
| GET    | `/users/search?q=`                | ✓    | Find users to chat with                |
| GET    | `/chats`                          | ✓    | All chats + per-chat unread counts     |
| POST   | `/chats/one-to-one`               | ✓    | Get-or-create DM                       |
| POST   | `/chats/group`                    | ✓    | Create group                           |
| GET    | `/chats/:id`                      | ✓    | Single chat                            |
| PATCH  | `/chats/:id/group`                | ✓    | Admin: update group                    |
| POST   | `/chats/:id/group/members`        | ✓    | Admin: add member                      |
| DELETE | `/chats/:id/group/members`        | ✓    | Admin: remove member                   |
| POST   | `/chats/:id/group/leave`          | ✓    | Leave group                            |
| POST   | `/messages`                       | ✓    | Send message (broadcasts via Socket.IO)|
| GET    | `/messages/:chatId?page=&limit=`  | ✓    | Paginated history                      |
| POST   | `/messages/:chatId/read`          | ✓    | Mark chat read                         |
| GET    | `/messages/unread/total`          | ✓    | Total unread (used by extension badge) |
| DELETE | `/messages/:id`                   | ✓    | Soft-delete own message                |
| GET    | `/notifications`                  | ✓    | Recent notifications                   |
| GET    | `/notifications/unread/count`     | ✓    |                                        |
| POST   | `/notifications/:id/read`         | ✓    |                                        |
| POST   | `/notifications/read-all`         | ✓    |                                        |
| POST   | `/upload`                         | ✓    | `multipart/form-data` field `file`     |

## Socket.IO events

Client → server: `chat:join`, `chat:leave`, `typing:start`, `typing:stop`, `message:read`.

Server → client: `message:new`, `notification:new`, `typing:start`, `typing:stop`, `presence:update`, `message:read`.

Auth: pass `{ auth: { token: <accessToken> } }` on the handshake.

## Deployment

### Backend → Render

1. Push the repo to GitHub.
2. In Render, **New +** → **Blueprint** → select your repo → choose `backend/render.yaml`.
3. Set the secrets prompted by `render.yaml` (`MONGODB_URI`, `CLIENT_URL`, `CLOUDINARY_*`, `EXTENSION_ORIGIN`).
4. Render will install with `--legacy-peer-deps` and start with `npm start`.
5. WebSockets work out of the box on Render — no config required.

### Frontend → Vercel

1. **Add new project** in Vercel, point to the `frontend/` directory.
2. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://<your-render-host>/api/v1`
   - `NEXT_PUBLIC_SOCKET_URL=https://<your-render-host>`
3. Deploy. The included `vercel.json` adds standard security headers.

### Extension → Chrome Web Store

1. Edit `extension/utils/config.js` so `DEFAULTS.API_URL`, `SOCKET_URL`, and `FRONTEND_URL` point at production.
2. Re-run `python3 scripts/build-icons.py` if you customized branding.
3. Zip the `extension/` directory contents (not the directory itself).
4. Upload via the Chrome Web Store Developer Dashboard.
5. After publishing, copy the extension ID and set `EXTENSION_ORIGIN=chrome-extension://<id>` on the backend so it's allowed by CORS.

## Production checklist

- [ ] MongoDB Atlas IP allowlist includes Render's egress range (or `0.0.0.0/0`).
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are 32+ random bytes (Render auto-generates).
- [ ] Cloudinary "unsigned uploads" disabled — uploads always go through the API.
- [ ] CORS `CLIENT_URL` matches your Vercel domain exactly (no trailing slash).
- [ ] `EXTENSION_ORIGIN` set after publishing the extension.
- [ ] Trust proxy is enabled (`app.set('trust proxy', 1)` — already configured).
- [ ] Rate limits tuned to your traffic (`RATE_LIMIT_*`).

## Scripts

```bash
# Backend
npm run dev         # ts-node-dev with hot reload
npm run build       # tsc → dist/
npm start           # node dist/app.js
npm run typecheck

# Frontend
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
```

## License

MIT
