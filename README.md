# Tambola Arena

Play Tambola / Housie online with friends. Unlimited players, free.
Host a game, share a code, everyone gets an auto-generated ticket and daubs
numbers as they are called.

**Stack**: Next.js 15 + TypeScript · Supabase (Postgres + Auth + Realtime) ·
Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Needs `.env.local` (see `.env.example`).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Status

- **Phase 1 (done)**: auth, host/join with invite code, live player list,
  server-shaped ticket generation, waiting room.
- **Phase 2 (next)**: number calling (auto + manual), daubing, called board.
- **Phase 3**: claims + server-side verification, winning patterns, finish.

## Docs

- [AGENTS.md](AGENTS.md) — architecture, layering, DB + game rules.
- [supabase/migrations/](supabase/migrations/) — schema (all `tambola_`-prefixed;
  shared Supabase project).
