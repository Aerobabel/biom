# Biom — свои люди рядом

A responsive Russian-language neighborhood social network MVP. React + TypeScript + Vite, Node/Express, PostgreSQL on Render, and file-backed SQLite for local development.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Local records survive restarts in `data/biom.sqlite`. Node 20 or later is required. `npm run check`, `npm test`, and `npm run build` verify the app. Environment variables must be supplied by your shell or hosting platform (`.env.example` documents their names).

## Implemented

- Email/password registration and login; salted scrypt password hashes, expiring server-side sessions, HttpOnly cookies, rate limits and origin checks.
- Editable name, bio, city, district and up to six interests. Email addresses are private.
- City-based feed with district, interest and text filters; discover people by interest and name.
- Create photo posts (JPG/PNG/WebP, up to 5 MB), likes, comments, bookmarks and deletion of your own posts.
- Private messages between registered people with six-second refresh, read state and blocking in both directions.
- Report posts, block/unblock users, and a moderator queue that can hide, restore or dismiss reported posts.
- Sample neighborhood events with stored participation. Sample profiles, posts and events are clearly marked. Demo profiles do not send or receive messages.
- Mobile navigation, responsive layouts, keyboard dialog focus, loading/error/empty states, reduced-motion support.

## Deploy to Render

Repository: https://github.com/Aerobabel/biom

`render.yaml` is an optional Blueprint that groups the service and database in the **MVP** project, **Production** environment. For an existing service/database, use their existing names and connection string instead of provisioning duplicates.

Web service: Node, Frankfurt, build `npm ci --include=dev && npm run check && npm run build`, start `npm start`, health `/api/health`. The tracked `.npmrc` includes build dependencies even when `NODE_ENV=production`. Set `NODE_ENV=production`, `NODE_VERSION=22.16.0`, `DATABASE_URL` to the Render database's **internal** URL, and `ADMIN_EMAIL` to the account email allowed to moderate. The database schema is initialized automatically and sample content is inserted idempotently. Photos are stored in the database for this small MVP, so no ephemeral upload directory is used.

Production intentionally refuses to run without PostgreSQL or an explicitly configured persistent disk (`DATA_DIR`). This prevents accounts and uploads disappearing after a Render restart.

### Hosting limits

The initial deployment uses Render's Free web and database plans. Free web services sleep after inactivity; the first request can be slow. The database created on 28 October 2026 expires on **27 November 2026**. Upgrade or export before that date. See https://render.com/docs/free.

## Scope and next stages

This is a working MVP, not a native iOS/Android package. Accounts do not yet verify email, self-service password reset is not implemented, and messaging uses polling rather than WebSockets. Event creation, push notifications, map geolocation and production analytics are outside this first version. The neighborhood map is an illustrative graphic; it does not expose live or precise locations.

Before a public launch: connect an email provider for verification/recovery, use permanent Postgres with backups, migrate images to object storage, add paginated database queries and a measured abuse policy. Moderation requires setting `ADMIN_EMAIL` and registering that account. No default administrator password is created.

## Assets and source handoff

Public Unsplash photos are downloaded into `public/assets` by `scripts/download-assets.mjs`. Asset IDs are recorded there. Seed people and community examples are fictional and are defined in `shared/seed.mjs`. Icons: Lucide. Typeface: Golos Text via Google Fonts, with an Arial fallback.

All application source, deployment configuration and tests are in this repository. No hosting credentials, user records, uploaded photos or session secrets belong in Git.
