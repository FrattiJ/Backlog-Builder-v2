# Hobbylog

Track every hobby backlog in one place — video games, movies, TV shows, books, manga, model kits, fitness, and art. Log your sessions, rank what to play or read next, and let the app fill in cover art and details automatically.

**Your data never leaves your computer.** Everything is stored in a local database on your PC — no account, no cloud, no tracking. The only things the app sends over the internet are search requests (like "Elden Ring") to fetch cover art and details.

---

## Installing the app

1. Go to the [**Releases page**](https://github.com/FrattiJ/Backlog-Builder-v2/releases).
2. Under the newest release, download the file ending in **`-setup.exe`** (ignore the other files).
3. Run it. **Windows will likely show a blue "Windows protected your PC" warning** — this is normal for small apps that aren't registered with Microsoft (registration costs hundreds of dollars a year). Click **"More info"**, then **"Run anyway"**.
4. Done. The app keeps itself up to date from now on — when a new version is out, a green **UPDATE AVAILABLE** box appears in the corner; click **INSTALL & RESTART** and you're current.

> Updating never touches your entries, sessions, or settings. They're stored separately from the app itself.

## First-time setup (5–10 minutes)

When you first open the app, you pick which hobbies you want to track, then a setup guide appears. Here's the same info in more detail.

### Do you need API keys?

API keys are free passwords that let the app search big movie/game databases. You only need the ones for hobbies you track:

| You track… | You need | Cost |
|---|---|---|
| Video games | A RAWG key | Free |
| Movies or TV shows | A TMDB key | Free |
| Books, manga, comics | Nothing — works out of the box | — |
| Projects, fitness, art | Nothing — these are manual-entry hobbies | — |

Without a key, the app still works — you just type entries in by hand instead of picking from search results with cover art.

### Getting your RAWG key (games)

1. Go to [rawg.io/apidocs](https://rawg.io/apidocs) and click **Get API Key**.
2. Create a free account (email + password).
3. You'll land on a page showing your key — a long string of letters and numbers. If you get asked for an app name or website, anything works ("personal use" / leave blank where allowed).
4. Copy the key, then in Hobbylog go to **Settings → API Keys**, paste it in the **RAWG** box, and click **Save**.

### Getting your TMDB key (movies & TV)

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup) and verify your email.
2. Go to [Settings → API](https://www.themoviedb.org/settings/api) and click to request an API key. Choose **Developer**, accept the terms, and fill in the short form (for "application" details, "personal hobby tracker" is fine).
3. Copy the value labeled **API Key** (sometimes called "API Key (v3 auth)") — **not** the longer "Read Access Token."
4. In Hobbylog: **Settings → API Keys**, paste it in the **TMDB** box, **Save**.

### Test it worked

Open a hobby page, click the **+** button, and type a title (3+ letters). Search results with cover art should appear. If nothing shows up, see [Troubleshooting](#troubleshooting).

---

## Importing lists you already have

Open **Import** in the sidebar and pick a tab. You can re-run imports safely — anything already in your library is skipped, never duplicated.

### Steam (your game library, with hours played)

You'll need two things:

- **Your profile:** open Steam, click your username → **Profile**, then copy the URL (right-click → Copy Page URL). Paste it into the Import page.
- **A Steam API key:** go to [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey), sign in, type anything in the "Domain Name" box (e.g. `localhost`), and copy the key.

Also make sure your game list is visible: in Steam, go to **Profile → Edit Profile → Privacy Settings** and set **Game details** to **Public**. (You can set it back to private after importing, but automatic playtime updates will stop working.)

After importing, your playtime refreshes automatically every time you open Hobbylog — no more manually logging hours for Steam games.

### MyAnimeList (anime & manga)

1. On MAL: click your profile picture → **Account Settings**, then find **Export Data** (or go to [myanimelist.net/panel.php?go=export](https://myanimelist.net/panel.php?go=export)).
2. Export your anime and/or manga list — you'll get a `.xml` file (unzip it if it downloads as `.gz` — right-click → Extract).
3. Drop the file into the Import page. Anime become TV shows, manga become Books → Manga, and cover art downloads automatically (a big list takes a few minutes — a progress bar shows what's happening).

### Letterboxd (movies)

Letterboxd → **Settings → Data** → **Export your data** → unzip → import the `diary.csv` or `watched.csv` file.

### Goodreads (books)

Goodreads → **My Books** → **Import and export** (left sidebar) → **Export Library** → import the `.csv` it emails you.

---

## Everyday use

- **Add something:** the **+** button on any hobby page, or **QUICK ADD** in the sidebar.
- **Log time:** **QUICK LOG** in the sidebar — search, pick an entry, log minutes/progress. Logging a backlog item automatically moves it to In Progress.
- **Rank your backlog:** on a hobby page, filter to **Backlog** and hit **RANK MODE** to drag entries into order. New items always join at the bottom; finishing or starting something moves everything below it up a spot.
- **Fix a missing cover or stale info:** open the entry and press **UPDATE DETAILS** (re-fetches everything, including cover art) or **SET COVER** (paste any image URL).
- **Notes:** the sidebar has a Notes tab — a scratchpad that saves as you type.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Search shows no results | Check **Settings → API Keys** — is the right key pasted and saved? Games need RAWG, movies/TV need TMDB. |
| Manga search shows an error about "rate limited" | The free manga database allows ~1 search per second. Wait a minute and try again. |
| Steam import says no games found | In Steam: Profile → Edit Profile → Privacy Settings → set **Game details** to **Public**. |
| Blue Windows warning when installing | Click **More info → Run anyway**. It appears because the app isn't registered with Microsoft, not because anything is wrong. |
| Update box never appears | Updates are checked when the app starts — close it fully and reopen. You need at least v0.2.0 (older builds can't self-update; install the newest release manually once). |
| Something looks broken after an update | Close and reopen the app. If it persists, reinstall from the Releases page — your data is safe. |
| Want to start completely fresh | Settings → scroll to the bottom → Clear All Data. |

**Where's my data?** In `%APPDATA%\com.hobbylog.app\` (paste that into the File Explorer address bar). Copy that folder to back up everything.

---

## Phone companion (optional, for tinkerers)

There's a mobile web page for quick-adding entries and logging sessions from your phone; they appear in the desktop app the next time you open it. Setting it up requires creating a free [Supabase](https://supabase.com) database and pasting its address into both the app and the phone page — instructions below. If that sounds like gibberish, skip this section; the app is fully functional without it.

<details>
<summary>Setup instructions</summary>

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard: **SQL Editor** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon/publishable key**.
4. Desktop app: **Settings → API Keys → Phone Sync** → paste both → Save.
5. On your phone, open **https://frattij.github.io/Backlog-Builder-v2/**, paste the same two values, and add the page to your home screen.

The key pair works like a shared password between your phone and desktop — don't post it anywhere public. It can only reach the sync mailbox, never your actual library, which exists only on your PC.

</details>

---

## For developers

<details>
<summary>Running from source, project layout, and releasing</summary>

### Prerequisites

- Node.js 20.9+ (24 recommended)
- Rust (stable) via [rustup](https://rustup.rs)
- Windows: Visual Studio Build Tools with the *Desktop development with C++* workload
- Other platforms: see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

### Commands

```bash
npm install
npm run dev           # dev server + app window with hot reload
npm run tauri-build   # build installers into src-tauri/target/release/bundle/
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

### Releasing

1. Bump `version` in `src-tauri/tauri.conf.json`.
2. Commit, push, then `git tag v0.x.y && git push origin v0.x.y`.
3. GitHub Actions builds, signs, and publishes the release (~15 min). Installed apps offer the update on next launch.

Needs the `TAURI_SIGNING_PRIVATE_KEY` repository secret (private key lives at `~/.tauri/hobbylog.key` on the maintainer's machine — **keep a backup**; without it, existing installs can never update again). The matching public key is in `src-tauri/tauri.conf.json`.

</details>
