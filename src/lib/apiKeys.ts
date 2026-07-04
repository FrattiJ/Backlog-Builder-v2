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

// Phone-companion sync target (see src/lib/sync.ts). Unset = sync disabled.
export async function getSyncConfig(): Promise<{ supabaseUrl: string; supabaseAnonKey: string }> {
  const store = await getStore()
  return {
    supabaseUrl: ((await store.get<string>('supabaseUrl')) ?? '').trim().replace(/\/+$/, ''),
    supabaseAnonKey: ((await store.get<string>('supabaseAnonKey')) ?? '').trim(),
  }
}

// ── RAWG search ──────────────────────────────────────────────────────────────

export async function searchIGDB(query: string) {
  const { rawgApiKey } = await getApiKeys()
  if (!rawgApiKey) throw new Error('RAWG API Key required. Go to Settings → API Keys.')

  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&key=${rawgApiKey}&page_size=15`
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
      // RAWG only provides a single community average playtime — no real HLTB data
      time_to_beat_main: g.playtime ? Number(g.playtime) : null,
      time_to_beat_rushed: null,
      time_to_beat_complete: null,
      rating: (g.rating as number) || null,
      platforms: Array.isArray(g.platforms)
        ? (g.platforms as Record<string, unknown>[]).map((p) => (p as Record<string, unknown>).platform).map((p) => (p as Record<string, string>).name).join(', ')
        : '',
      source: 'rawg',
    }))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(`Game search error: ${message}`)
  }
}

export async function fetchRAWGGameDetails(id: string): Promise<{ developers: string | null; publishers: string | null; platforms: string | null; rating: number | null; cover_url: string | null }> {
  const { rawgApiKey } = await getApiKeys()
  if (!rawgApiKey) return { developers: null, publishers: null, platforms: null, rating: null, cover_url: null }
  try {
    const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${rawgApiKey}`)
    const data = await res.json()
    const developers = Array.isArray(data.developers)
      ? (data.developers as Record<string, string>[]).map((d) => d.name).join(', ')
      : null
    const publishers = Array.isArray(data.publishers)
      ? (data.publishers as Record<string, string>[]).map((p) => p.name).join(', ')
      : null
    const platforms = Array.isArray(data.platforms)
      ? (data.platforms as Record<string, Record<string, string>>[]).map((p) => p.platform?.name).filter(Boolean).join(', ')
      : null
    const rating = (data.rating as number) ?? null
    return { developers, publishers, platforms, rating, cover_url: (data.background_image as string) || null }
  } catch {
    return { developers: null, publishers: null, platforms: null, rating: null, cover_url: null }
  }
}

export async function searchTMDB(query: string, type: 'movie' | 'tv') {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return []

  const res = await fetch(
    `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}&api_key=${tmdbApiKey}&page=1`
  )
  const data = await res.json()
  return (data.results ?? []).slice(0, 15).map((item: Record<string, unknown>) => ({
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

// Extract US streaming providers from a TMDB watch/providers response
function parseWatchProviders(data: Record<string, unknown>): string | null {
  const results = data.results as Record<string, Record<string, unknown>> | undefined
  const us = results?.US
  if (!us) return null
  const flatrate = us.flatrate as Record<string, string>[] | undefined
  if (!Array.isArray(flatrate) || flatrate.length === 0) return null
  return flatrate.slice(0, 4).map((p) => p.provider_name).join(', ')
}

export async function fetchTMDBWatchProviders(id: string, type: 'movie' | 'tv'): Promise<string | null> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return null
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${tmdbApiKey}`)
    if (!res.ok) return null
    return parseWatchProviders(await res.json())
  } catch {
    return null
  }
}

export async function fetchTMDBMovieDetails(id: string): Promise<{ runtime: number | null; director: string | null; studios: string | null; rating: number | null; streaming: string | null; cover_url: string | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { runtime: null, director: null, studios: null, rating: null, streaming: null, cover_url: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}&append_to_response=credits,watch/providers`)
    const data = await res.json()

    // Get director from credits
    let director: string | null = null
    if (data.credits?.crew) {
      const directorObj = (data.credits.crew as Record<string, unknown>[]).find((c) => c.job === 'Director')
      director = directorObj ? (directorObj.name as string) : null
    }

    // Get studios
    const studios = Array.isArray(data.production_companies)
      ? (data.production_companies as Record<string, string>[]).slice(0, 2).map((c) => c.name).join(', ')
      : null

    // Get streaming providers (append_to_response nests them under 'watch/providers')
    const streaming = data['watch/providers'] ? parseWatchProviders(data['watch/providers']) : null

    return {
      runtime: (data.runtime as number) ?? null,
      director,
      studios,
      rating: (data.vote_average as number) ?? null,
      streaming,
      cover_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    }
  } catch {
    return { runtime: null, director: null, studios: null, rating: null, streaming: null, cover_url: null }
  }
}

export async function fetchTMDBTVDetails(id: string): Promise<{ episodes: number | null; seasons: number | null; episodeRuntime: number | null; creator: string | null; networks: string | null; rating: number | null; streaming: string | null; cover_url: string | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { episodes: null, seasons: null, episodeRuntime: null, creator: null, networks: null, rating: null, streaming: null, cover_url: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}&append_to_response=watch/providers`)
    const data = await res.json()

    // episode_run_time is an array, get the first value (most common episode length)
    const episodeRuntime = Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
      ? (data.episode_run_time[0] as number)
      : null

    // Get creator
    const creator = Array.isArray(data.created_by) && data.created_by.length > 0
      ? ((data.created_by as Record<string, string>[])[0].name ?? null)
      : null

    // Get networks
    const networks = Array.isArray(data.networks)
      ? (data.networks as Record<string, string>[]).slice(0, 2).map((n) => n.name).join(', ')
      : null

    const streaming = data['watch/providers'] ? parseWatchProviders(data['watch/providers']) : null

    return {
      episodes: (data.number_of_episodes as number) ?? null,
      seasons: (data.number_of_seasons as number) ?? null,
      episodeRuntime,
      creator,
      networks,
      rating: (data.vote_average as number) ?? null,
      streaming,
      cover_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    }
  } catch {
    return { episodes: null, seasons: null, episodeRuntime: null, creator: null, networks: null, rating: null, streaming: null, cover_url: null }
  }
}

export async function calculateTVProgressFromSeason(tvId: string, season: number, episode: number): Promise<number | null> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return null
  try {
    // Fetch episodes for all seasons up to and including the target season
    let totalEpisodes = 0
    for (let s = 1; s < season; s++) {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${s}?api_key=${tmdbApiKey}`)
      if (!res.ok) continue
      const data = await res.json()
      const episodes = (data.episodes as Record<string, unknown>[]) ?? []
      totalEpisodes += episodes.length
    }
    // Add the episodes in the current season
    totalEpisodes += episode
    return totalEpisodes
  } catch (e) {
    console.error('Error calculating TV progress:', e)
    return null
  }
}

export async function searchOpenLibrary(query: string) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publisher&limit=15`
  )
  const data = await res.json()
  return (data.docs ?? []).map((book: Record<string, unknown>) => ({
    id: String(book.key),
    title: book.title as string,
    cover_url: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : null,
    author: Array.isArray(book.author_name) ? (book.author_name as string[])[0] : null,
    publisher: Array.isArray(book.publisher) ? (book.publisher as string[])[0] : null,
    pages: (book.number_of_pages_median as number) ?? null,
    year: (book.first_publish_year as number) ?? null,
    source: 'openlibrary',
  }))
}

export async function fetchOpenLibraryDetails(id: string): Promise<{ author: string | null; publisher: string | null; cover_url: string | null }> {
  try {
    const res = await fetch(`https://openlibrary.org${id}.json`)
    const data = await res.json()
    const author = data.authors?.[0]?.name ?? null
    const publisher = Array.isArray(data.publishers) ? data.publishers[0] : null
    const coverId = Array.isArray(data.covers) ? (data.covers as number[]).find((c) => c > 0) : null
    return { author, publisher, cover_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null }
  } catch {
    return { author: null, publisher: null, cover_url: null }
  }
}

// Jikan rate limit: 3 req/sec, 60 req/min. Retries once on 429, throws on other errors
// so callers surface the real failure instead of showing empty results.
export async function jikanFetch(url: string): Promise<Record<string, unknown>> {
  let res = await fetch(url)
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200))
    res = await fetch(url)
  }
  if (!res.ok) {
    throw new Error(`MyAnimeList (Jikan) API error: HTTP ${res.status}${res.status === 429 ? ' — rate limited, wait a minute and retry' : ''}`)
  }
  return (await res.json()) as Record<string, unknown>
}

export function jikanCover(m: Record<string, unknown>): string | null {
  const images = m.images as Record<string, Record<string, string>> | undefined
  return images?.jpg?.large_image_url ?? images?.jpg?.image_url ?? null
}

export async function searchJikan(query: string) {
  const data = await jikanFetch(
    `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=15&sfw=true`
  )
  return ((data.data as Record<string, unknown>[]) ?? []).map((m) => ({
    id: String(m.mal_id),
    title: ((m.title_english ?? m.title) as string),
    cover_url: jikanCover(m),
    synopsis: (m.synopsis as string) ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    status: m.status ?? null,
    rating: (m.score as number) ?? null,
    source: 'jikan',
  }))
}

export async function fetchJikanDetails(id: string): Promise<{ author: string | null; rating: number | null; chapters: number | null; volumes: number | null; cover_url: string | null }> {
  try {
    const data = await jikanFetch(`https://api.jikan.moe/v4/manga/${id}`)
    const mangaData = data.data as Record<string, unknown>
    const authors = mangaData.authors as Record<string, unknown>[] | undefined
    const author = authors?.[0] ? (authors[0] as Record<string, string>).name : null
    return {
      author,
      rating: (mangaData.score as number) ?? null,
      chapters: (mangaData.chapters as number) ?? null,
      volumes: (mangaData.volumes as number) ?? null,
      cover_url: jikanCover(mangaData),
    }
  } catch {
    return { author: null, rating: null, chapters: null, volumes: null, cover_url: null }
  }
}

// For MAL-imported anime (stored as TV entries with a MAL id — TMDB ids don't apply)
export async function fetchJikanAnimeDetails(id: string): Promise<{ episodes: number | null; rating: number | null; studios: string | null; episodeRuntime: number | null; cover_url: string | null }> {
  try {
    const data = await jikanFetch(`https://api.jikan.moe/v4/anime/${id}`)
    const anime = data.data as Record<string, unknown>
    const studioArr = anime.studios as Record<string, unknown>[] | undefined
    const studios = studioArr?.length ? studioArr.map((s) => (s as Record<string, string>).name).slice(0, 2).join(', ') : null
    // Jikan duration is a string like "24 min per ep"
    const durationMatch = typeof anime.duration === 'string' ? anime.duration.match(/^(\d+)\s*min/) : null
    return {
      episodes: (anime.episodes as number) ?? null,
      rating: (anime.score as number) ?? null,
      studios,
      episodeRuntime: durationMatch ? parseInt(durationMatch[1], 10) : null,
      cover_url: jikanCover(anime),
    }
  } catch {
    return { episodes: null, rating: null, studios: null, episodeRuntime: null, cover_url: null }
  }
}
