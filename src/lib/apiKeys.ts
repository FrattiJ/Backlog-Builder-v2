import { load } from '@tauri-apps/plugin-store'

let _store: Awaited<ReturnType<typeof load>> | null = null

async function getStore() {
  if (!_store) _store = await load('api-keys.json', { autoSave: true, defaults: {} })
  return _store
}

export async function getApiKeys(): Promise<{
  rawgApiKey: string
  tmdbApiKey: string
}> {
  const store = await getStore()
  return {
    rawgApiKey: (await store.get<string>('rawgApiKey')) ?? '',
    tmdbApiKey: (await store.get<string>('tmdbApiKey')) ?? '',
  }
}

export async function setApiKey(key: string, value: string) {
  const store = await getStore()
  await store.set(key, value)
}

// ── RAWG search ──────────────────────────────────────────────────────────────

export async function searchIGDB(query: string) {
  const { rawgApiKey } = await getApiKeys()
  if (!rawgApiKey) throw new Error('RAWG API Key required. Go to Settings → API Keys.')

  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&key=${rawgApiKey}&page_size=6`
    )

    if (!res.ok) {
      throw new Error(`RAWG API error: ${res.status}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const results = ((data.results as Record<string, unknown>[]) || [])

    return results.map((g: Record<string, unknown>) => ({
      id: String(g.id),
      title: g.name as string,
      cover_url: (g.background_image as string) || null,
      genres: Array.isArray(g.genres)
        ? (g.genres as Record<string, unknown>[]).map((x) => x.name).join(', ')
        : '',
      release_year: g.released
        ? new Date(g.released as string).getFullYear()
        : null,
      summary: (g.description as string) ?? null,
      time_to_beat_main: g.playtime ? Math.round(Number(g.playtime) * 1.5) : null,
      time_to_beat_rushed: g.playtime ? Number(g.playtime) : null,
      time_to_beat_complete: g.playtime ? Math.round(Number(g.playtime) * 2) : null,
      source: 'rawg',
    }))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(`Game search error: ${message}`)
  }
}

export async function searchTMDB(query: string, type: 'movie' | 'tv') {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return []

  const res = await fetch(
    `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}&api_key=${tmdbApiKey}&page=1`
  )
  const data = await res.json()
  return (data.results ?? []).slice(0, 6).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    title: ((item.title ?? item.name) as string),
    cover_url: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    overview: (item.overview as string) ?? null,
    release_date: ((item.release_date ?? item.first_air_date) as string) ?? null,
    source: 'tmdb',
    type,
  }))
}

export async function fetchTMDBMovieDetails(id: string): Promise<{ runtime: number | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { runtime: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`)
    const data = await res.json()
    return {
      runtime: (data.runtime as number) ?? null,
    }
  } catch {
    return { runtime: null }
  }
}

export async function fetchTMDBTVDetails(id: string): Promise<{ episodes: number | null; seasons: number | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { episodes: null, seasons: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`)
    const data = await res.json()
    return {
      episodes: (data.number_of_episodes as number) ?? null,
      seasons: (data.number_of_seasons as number) ?? null,
    }
  } catch {
    return { episodes: null, seasons: null }
  }
}

export async function searchOpenLibrary(query: string) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year&limit=6`
  )
  const data = await res.json()
  return (data.docs ?? []).map((book: Record<string, unknown>) => ({
    id: String(book.key),
    title: book.title as string,
    cover_url: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : null,
    author: Array.isArray(book.author_name) ? (book.author_name as string[])[0] : null,
    pages: (book.number_of_pages_median as number) ?? null,
    year: (book.first_publish_year as number) ?? null,
    source: 'openlibrary',
  }))
}

export async function searchJikan(query: string) {
  const res = await fetch(
    `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=6&sfw=true`
  )
  const data = await res.json()
  return (data.data ?? []).map((m: Record<string, unknown>) => {
    const images = m.images as Record<string, Record<string, string>>
    return {
      id: String(m.mal_id),
      title: ((m.title_english ?? m.title) as string),
      cover_url: images?.jpg?.large_image_url ?? images?.jpg?.image_url ?? null,
      synopsis: (m.synopsis as string) ?? null,
      chapters: m.chapters ?? null,
      volumes: m.volumes ?? null,
      status: m.status ?? null,
      source: 'jikan',
    }
  })
}
