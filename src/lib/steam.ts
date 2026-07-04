import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { getEntriesByHobby, updateEntry } from '@/lib/db'

export interface SteamGame {
  appid: number
  name: string
  playtime_hours: number
}

// Resolve a profile URL / vanity name / SteamID64 and fetch the owned-games library
export async function fetchSteamLibrary(input: string, key: string): Promise<SteamGame[]> {
  if (!key.trim()) throw new Error('API key is required')
  let steamId = input.trim()
  const profileMatch = steamId.match(/\/profiles\/(\d{17})/)
  const vanityMatch = steamId.match(/\/id\/([^/\s]+)/)
  if (profileMatch) {
    steamId = profileMatch[1]
  } else if (vanityMatch) {
    let res: Response
    try {
      res = await tauriFetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${vanityMatch[1]}`
      )
    } catch (e) {
      throw new Error(`Fetch error (vanity): ${e instanceof Error ? e.message : String(e)}`)
    }
    if (res.status === 403) throw new Error('Invalid API key — double-check the key and wait a few minutes if it was just registered')
    if (!res.ok) throw new Error(`Steam API returned ${res.status} when resolving profile URL`)
    const data = await res.json()
    if (data.response?.success !== 1) throw new Error('Could not find that Steam profile — check the URL is correct')
    steamId = data.response.steamid
  }
  if (!/^\d{17}$/.test(steamId)) throw new Error('Enter your full Steam profile URL (e.g. steamcommunity.com/id/yourname) or your 17-digit Steam ID64')

  let res: Response
  try {
    res = await tauriFetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=true&format=json`
    )
  } catch (e) {
    throw new Error(`Fetch error (games): ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 403) throw new Error('Invalid API key — double-check the key and wait a few minutes if it was just registered')
  if (!res.ok) throw new Error(`Steam API returned ${res.status} — check your API key`)
  const data = await res.json()
  const games: Array<{ appid: number; name: string; playtime_forever: number }> = data.response?.games
  if (!games?.length) throw new Error('No games returned — make sure Game Details is set to Public in your Steam Privacy Settings (Profile → Edit Profile → Privacy Settings)')

  return games.map((g) => ({
    appid: g.appid,
    name: g.name,
    playtime_hours: Math.round(g.playtime_forever / 60 * 10) / 10,
  }))
}

// Steam names carry trademark glyphs that manual titles won't have
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[™®©]/g, '').trim()
}

let syncedThisSession = false

// Pull current Steam playtime into game entries. Runs once per app session, silently
// skipped when Steam credentials were never entered (they're saved by the Steam import).
// Matches by stored appid first, then by exact title for manually-added games (and links
// the appid so future syncs are direct). Playtime only ever increases an entry's hours.
export async function syncSteamPlaytime(): Promise<number | null> {
  if (syncedThisSession) return null
  syncedThisSession = true

  const profile = localStorage.getItem('import_steam_profile')
  const key = localStorage.getItem('import_steam_key')
  if (!profile || !key) return null

  const library = await fetchSteamLibrary(profile, key)
  const byAppid = new Map(library.map((g) => [g.appid, g]))
  const byTitle = new Map(library.map((g) => [normalizeTitle(g.name), g]))

  const entries = await getEntriesByHobby('games')
  let updated = 0
  for (const entry of entries) {
    const storedAppid = (entry.metadata?.steam_appid as number | undefined)
      ?? (entry.external_source === 'steam' && entry.external_id ? Number(entry.external_id) : undefined)
    const game = storedAppid != null ? byAppid.get(storedAppid) : byTitle.get(normalizeTitle(entry.title))
    if (!game) continue

    const newlyLinked = storedAppid == null
    const hours = game.playtime_hours
    const increased = hours > (entry.progress_current || 0)
    if (!newlyLinked && !increased) continue

    await updateEntry(entry.id, {
      ...(increased ? { progress_current: hours } : {}),
      metadata_patch: { steam_appid: game.appid, playtime_hours: hours },
    })
    updated++
  }
  return updated
}
