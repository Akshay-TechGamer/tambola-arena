# AGENTS.md — Tambola Arena

Guide for AI agents (and humans). Follow exactly.

## What is this?

Online Tambola / Housie game, built from scratch. A host creates a game and
shares an invite code; players join, get auto-generated tickets, and daub
numbers as they are called. Claims (Early Five, lines, corners, full house)
are verified server-side. Unlimited players, all free — no paywall.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 + TypeScript (App Router), Vercel |
| DB / Auth / Realtime | Supabase (Postgres). SHARED project — prefix every object `tambola_` |
| Validation | zod (later phases) |
| Tests | vitest (required for everything in `lib/game/`) |

## Shared Supabase project — read this

This project's Supabase instance also hosts other apps (chess `chess_*`, plus
`wishes`, `game_rooms`, ...). Touch ONLY `tambola_*` objects. Never alter or
drop anything without the `tambola_` prefix.

## Layering (same discipline as chess-arena)

```
app/          Next.js routes. Thin.
components/   UI only. MUST NOT import Supabase or touch the DB.
lib/game/     Pure Tambola logic (ticket gen, pattern validation, draw).
              MUST NOT import Supabase/React/Next. 100% unit-tested.
lib/data/     ALL database access (one repo file per concern). Only layer
              allowed to import the Supabase client.
lib/realtime/ Thin Supabase Realtime interface (subscribe/publish).
supabase/     migrations/ (SQL) + edge functions.
```

## Database rules

- Every schema change is a new file in `supabase/migrations/`, `tambola_`-prefixed.
- Append-only: never edit an applied migration; write a new one.
- RLS enabled on every table in the same migration that creates it.
- Regenerate types after schema changes:
  `supabase gen types --linked --lang=typescript --schema public > lib/data/database.types.ts`

## Game rules (so logic stays correct)

- Ticket: 3×9, exactly 5 numbers per row (15 total); column j range fixed
  (col 0: 1-9 ... col 8: 80-90); 1-3 numbers per column, ascending down a column.
- 90 numbers called once each, no repeats.
- Patterns: Early Five, Top/Middle/Bottom Line, Four Corners, Full House.
- A claim is valid only if all its numbers were actually called; else it is a
  "bogey" (false claim). Each prize is won once.

## Anti-cheat (hardening lands in a later phase, like chess did)

- Number drawing (RNG + no-repeat) and claim verification MUST become
  server-side (RPC / edge function) before real prizes matter.
- Ticket generation should also move server-side for fairness.

## Must NOT

- Do not hand-roll ticket/pattern math in components — it lives in `lib/game/`.
- Do not touch non-`tambola_` database objects.
- Do not commit without `npm run lint && npm run typecheck && npm test` passing.
