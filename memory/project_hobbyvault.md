---
name: project-hobbyvault
description: HobbyVault full-stack app overview — tech stack, structure, and setup requirements
metadata:
  type: project
---

HobbyVault is a dark-themed hobby tracking web app built with Next.js 14 App Router, TypeScript, Supabase auth+database, Tailwind CSS, and Recharts.

**Why:** User wants to track 8 hobby categories (games, movies, TV, audiobooks, manga, gundams, sports, art) with API-backed metadata search and social profiles.

**How to apply:** When making changes, keep the dark gaming aesthetic (#0d0d0f base, #161618 cards) and per-hobby accent colors defined in `src/lib/hobbies.ts`.

## Setup required before running
1. Create a Supabase project → run `supabase/schema.sql` in the SQL editor
2. Fill `.env.local` with real keys:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` (Twitch dev console)
   - `TMDB_API_KEY` (themoviedb.org)

## Key files
- `src/lib/hobbies.ts` — hobby config (accent colors, icons, progress labels)
- `src/lib/supabase/client.ts` + `server.ts` — Supabase clients
- `src/middleware.ts` — auth redirect middleware
- `src/components/HobbyPage.tsx` — shared hobby page (filter/search/grid)
- `src/components/AddEntryModal.tsx` — add entry modal with API search
- `src/app/entry/[id]/EntryDetailClient.tsx` — entry detail + session log
- `src/app/stats/StatsClient.tsx` — Recharts stats dashboard

## Hobby routes
/games /movies /tv /audiobooks /manga /gundams /sports /art — all use HobbyPage component
