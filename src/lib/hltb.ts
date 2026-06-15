import { open } from '@tauri-apps/plugin-shell'
import { invoke } from '@tauri-apps/api/core'

export function openHLTB(gameTitle: string) {
  const query = encodeURIComponent(gameTitle)
  open(`https://howlongtobeat.com/?q=${query}`)
}

export interface HLTBResult {
  main: number | null      // Main Story (hours)
  mainPlus: number | null  // Main + Extras (hours)
  complete: number | null  // Completionist (hours)
}

export async function searchHLTB(title: string): Promise<HLTBResult | null> {
  try {
    // Rust command uses reqwest with native-tls (SChannel on Windows)
    // to bypass Cloudflare's TLS fingerprint block on rustls
    const raw = await invoke<string>('search_hltb', { title })
    const data = JSON.parse(raw) as {
      data?: Array<{ game_name: string; comp_main: number; comp_plus: number; comp_100: number }>
    }
    const games = data.data ?? []
    console.log(`[HLTB] "${title}" → ${games.length} results`)
    if (!games.length) return null

    const titleLower = title.toLowerCase()
    const match = games.find(g => g.game_name.toLowerCase() === titleLower) ?? games[0]
    const toHours = (secs: number): number | null => secs > 0 ? Math.round(secs / 3600 * 10) / 10 : null
    return {
      main: toHours(match.comp_main),
      mainPlus: toHours(match.comp_plus),
      complete: toHours(match.comp_100),
    }
  } catch (e) {
    console.error(`[HLTB] searchHLTB failed for "${title}":`, e)
    return null
  }
}
