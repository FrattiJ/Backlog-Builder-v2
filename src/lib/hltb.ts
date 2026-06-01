import { open } from '@tauri-apps/plugin-shell'

export function openHLTB(gameTitle: string) {
  const query = encodeURIComponent(gameTitle)
  open(`https://howlongtobeat.com/?q=${query}`)
}
