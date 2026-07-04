# Hobbylog

A local-first desktop app for tracking every hobby backlog in one place — video games, movies, TV, books/manga, model kits, fitness, and art. Log sessions, rank your backlog, pull rich metadata automatically, and see where all your hours go. All data lives in a local SQLite database on your machine: no accounts, no cloud, no tracking.

Built with [Tauri v2](https://v2.tauri.app) (Rust) + [Next.js](https://nextjs.org) (React, static export).

## Features

- **Seven hobby categories** — Video Games, Movies, TV Shows, Books (with subtypes: book, audiobook, manga, comic, webtoon, light novel), Projects, Fitness, Art. Enable only the ones you want.
- **Search-powered adding** — type a title and pick from live results with cover art, metadata, and totals filled in automatically.
- **Backlog ranking** — drag-rank your backlog per hobby. New items queue at the bottom; starting/completing/deleting an item closes the gap automatically.
- **Session logging** — quick-log time and progress from anywhere in the app. TV tracks season/episode, games track hours, books track pages/chapters.
- **Time-to-beat** — games get HowLongToBeat Main + Extras data fetched automatically.
- **Steam import + auto-sync** — import your whole Steam library with playtime, then playtime refreshes automatically each time you open the app.
- **Imports** — MyAnimeList (anime + manga, with cover art), Letterboxd, Goodreads, Steam.
- **Stats dashboard** — backlog hours, finished hours, completion rates, category breakdowns.
- **Notes tab** — persistent freeform notes with basic formatting; saves as you type.
- **Phone companion** — quick-add entries and log sessions from your phone; they sync into the desktop app on next launch (optional, needs a free Supabase project).
- **Auto-updates** — the app checks GitHub Releases on launch and updates itself with one click.

---

## Installing (for users)

1. Download the latest `Hobbylog_x.y.z_x64-setup.exe` from [Releases](https://github.com/FrattiJ/Backlog-Builder-v2/releases).
2. Run the installer. Windows SmartScreen may warn because the app isn't code-signed — click *More info → Run anyway*.
3. That's the only manual install you'll ever do: the app self-updates from GitHub Releases on launch.

Your data lives in `%APPDATA%\com.hobbylog.app\` and survives updates and reinstalls.

### First-run setup

On first launch you pick your hobby categories, then a setup guide walks you through the rest. In short:

| What | Where | Why |
|------|-------|-----|
| RAWG API key (free) | [rawg.io/apidocs](https://rawg.io/apidocs) → Settings → API Keys | Game search, cover art, metadata |
| TMDB API key (free) | [themoviedb.org](https://www.themoviedb.org/settings/api) → Settings → API Keys | Movie & TV search, posters, episode counts |
| Nothing | — | Books (OpenLibrary), manga (MyAnimeList/Jikan), and HowLongToBeat need no keys |

### Importing your existing lists

Go to **Import** in the sidebar:

- **Steam** — needs your profile URL/ID and a free [Steam Web API key](https://steamcommunity.com/dev/apikey). Set *Game Details* to Public in your Steam privacy settings. Playtime auto-syncs on every app launch afterward.
- **MyAnimeList** — export from MAL (*Account → Export Data*), drop the `.xml` file in. Anime imports as TV shows, manga as books, with cover art fetched automatically.
- **Letterboxd** — export your data from Letterboxd settings, import the diary `.csv`.
- **Goodreads** — export your library as `.csv` and drop it in.

---

## Phone companion (optional)

A tiny mobile web app for capturing things on the go — "add Elden Ring to my backlog," "log 45 minutes of reading" — that sync into the desktop app the next time you open it. The desktop app remains the source of truth; the phone only writes to a small "inbox."

**Setup (~5 minutes):**

1. Create a free project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Grab your **Project URL** and **anon key** from *Project Settings → API*.
4. In the desktop app: **Settings → API Keys → Phone Sync**, paste both values, save.
5. On your phone, open the companion page: **https://frattij.github.io/Backlog-Builder-v2/** — paste the same two values when prompted (stored only on your phone). Add it to your home screen for app-like access.

The phone page has two tabs: **ADD** (title + category + status) and **LOG** (search your library, log minutes/progress). Everything queues in Supabase and lands in the desktop app on next launch.

> The anon key is a shared device credential — don't post it publicly. It can only touch the two mailbox tables, never your real library, which only exists on your desktop.

---

## Development

### Prerequisites

- **Node.js** 20.9+ (24 recommended)
- **Rust** (stable) via [rustup](https://rustup.rs)
- **Windows:** Visual Studio Build Tools with the *Desktop development with C++* workload
- See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for other platforms

### Running

```bash
npm install
npm run dev        # starts Next.js dev server + Tauri window with hot reload
```

### Building an installer locally

```bash
npm run tauri-build
# installers land in src-tauri/target/release/bundle/
```

### Project layout

```
src/                  Next.js frontend (static export)
  app/                routes (dashboard, hobby pages, stats, import, settings, entry detail)
  components/         shared UI (Sidebar, AddEntryModal, QuickLogModal, HobbyPage, …)
  lib/                db.ts (SQLite), apiKeys.ts (external APIs), hltb.ts, sync.ts, hours.ts
src-tauri/            Rust backend (Tauri config, HLTB fetch command, plugins)
companion/            phone companion web app (deployed to GitHub Pages)
supabase/schema.sql   phone-sync mailbox schema
.github/workflows/    release.yml (tag-triggered builds), pages.yml (companion deploy)
```

---

## Releasing (maintainer)

Releases are built, signed, and published automatically by GitHub Actions:

1. Bump `version` in `src-tauri/tauri.conf.json`.
2. Commit and push, then tag:
   ```bash
   git tag v0.2.1 && git push origin v0.2.1
   ```
3. ~15 minutes later the release is live and every installed app offers the update on next launch.

Requirements (already configured for this repo):
- Repository secret `TAURI_SIGNING_PRIVATE_KEY` — the updater signing key. The private key lives at `~/.tauri/hobbylog.key` on the maintainer's machine. **Back it up**; if it's lost, existing installs can never update again.
- The matching public key is in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
