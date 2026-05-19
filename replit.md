# Sanctuary

A private, multi-tenant Family Social Network and Interactive Tree Platform — a secure digital home for family stories, trees, media, and memories.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/family-tree run dev` — run the frontend (port 22551)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 (three themes: Heritage / Vibrant / Cyber)
- API: Express 5 (port 8080, path `/api`)
- Database: Firebase Firestore (via Admin SDK on server)
- Realtime: Firebase RTDB (client SDK for chat)
- Media: Cloudinary (signed uploads)
- AI: OpenAI GPT-4o (relationship calculator + family chronicle generator)
- Auth: JWT (Bearer token stored in localStorage as `auth_token`)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)

## Where things live

```
artifacts/
  api-server/         Express API (port 8080)
    src/
      app.ts          Express app (CORS, middleware)
      index.ts        Entry point
      routes/         Route handlers (auth, families, members, posts, comments, media, notifications, events, admin)
      middlewares/    Auth middleware (requireAuth, requireGatekeeper, etc.)
      lib/            firebase.ts, cloudinary.ts, openai.ts, logger.ts, audit.ts
  family-tree/        React+Vite frontend (port 22551)
    src/
      main.tsx        Entry — wires setAuthTokenGetter + optional VITE_API_URL
      App.tsx         Router (wouter) + QueryClient
      components/     Layout.tsx, Sidebar.tsx, ThemeSelector.tsx, ui/
      contexts/       AuthContext.tsx (useAuth, ProtectedRoute, GatekeeperRoute)
      pages/          login, register, feed, tree, profile, gallery, events, capsules,
                      notifications, chat, map, gatekeeper, system-cockpit
      lib/            firebase.ts (client SDK), cloudinary.ts (upload util)
lib/
  api-spec/           openapi.yaml — source of truth for API contract
  api-client-react/   Generated React Query hooks + Zod schemas (do not edit generated/)
    src/
      custom-fetch.ts   Bearer token fetcher (setAuthTokenGetter, setBaseUrl)
      index.ts          Barrel exports
```

## Architecture decisions

- JWT Bearer tokens stored in `localStorage` — not cookies — so `setAuthTokenGetter` is bootstrapped in `main.tsx` before any query runs.
- `VITE_API_URL` env var optionally overrides the API base URL (needed when frontend and API are on different domains, e.g. Render separate deployments).
- All family-scoped data is nested under `families/{familyId}/…` in Firestore.
- Orval codegen generates typed React Query hooks from the OpenAPI spec; never call the API directly in components.
- Three CSS themes (`heritage`, `vibrant`, `cyber`) are implemented via `data-theme` attribute on `<html>` and CSS variables in `index.css`.
- The Gatekeeper role controls family access approval, invite links, role management, and AI chronicle generation.

## Product — Feature Modules

| # | Module | Path |
|---|--------|------|
| 1 | Family Feed | `/feed` |
| 2 | Interactive Family Tree | `/tree` |
| 3 | Member Profiles | `/profile/:id` |
| 4 | Media Gallery | `/gallery` |
| 5 | Events & RSVPs | `/events` |
| 6 | Time Capsules | `/capsules` |
| 7 | Notifications | `/notifications` |
| 8 | Real-time Chat (RTDB) | `/chat` |
| 9 | World Map (member pins) | `/map` |
| 10 | Gatekeeper Dashboard | `/gatekeeper` |
| 11 | System Cockpit (master admin) | `/system-cockpit` |

## Environment variables required

### API server
- `SESSION_SECRET` — JWT signing secret
- `FIREBASE_SERVICE_ACCOUNT_KEY` — Firebase Admin SDK JSON (stringified)
- `OPENAI_API_KEY` — OpenAI API key
- `CLOUDINARY_API_KEY` — Cloudinary API key
- `CLOUDINARY_API_SECRET` — Cloudinary API secret
- `PORT` — injected by workflow

### Frontend (prefix VITE_)
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`
- `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`
- `VITE_API_URL` *(optional)* — override API base URL for cross-domain production deployments

## User preferences

- User prefers Git push for deployment — API on Render (auto-builds from GitHub), frontend on Replit deployment.

## Gotchas

- Always run codegen after editing `openapi.yaml`: `pnpm --filter @workspace/api-spec run codegen`
- `setAuthTokenGetter` must be called before any query runs — it lives in `main.tsx`.
- The Sidebar polls unread notifications every query-cache cycle; keep the notifications route fast.
- Firebase RTDB chat is entirely client-side — no Express route handles it.
- The `req.log` (pino-http) logger must be used inside route handlers, never `console.log`.
- Chronicle generation is synchronous (OpenAI call blocks) — can take 10–30 seconds.
