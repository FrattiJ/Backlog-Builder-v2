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

export async function fetchRAWGGameDetails(id: string): Promise<{ developers: string | null; publishers: string | null; platforms: string | null; rating: number | null }> {
  const { rawgApiKey } = await getApiKeys()
  if (!rawgApiKey) return { developers: null, publishers: null, platforms: null, rating: null }
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
    return { developers, publishers, platforms, rating }
  } catch {
    return { developers: null, publishers: null, platforms: null, rating: null }
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

export async function fetchTMDBMovieDetails(id: string): Promise<{ runtime: number | null; director: string | null; studios: string | null; rating: number | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { runtime: null, director: null, studios: null, rating: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}&append_to_response=credits`)
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

    return {
      runtime: (data.runtime as number) ?? null,
      director,
      studios,
      rating: (data.vote_average as number) ?? null,
    }
  } catch {
    return { runtime: null, director: null, studios: null, rating: null }
  }
}

export async function fetchTMDBTVDetails(id: string): Promise<{ episodes: number | null; seasons: number | null; episodeRuntime: number | null; creator: string | null; networks: string | null; rating: number | null }> {
  const { tmdbApiKey } = await getApiKeys()
  if (!tmdbApiKey) return { episodes: null, seasons: null, episodeRuntime: null, creator: null, networks: null, rating: null }
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`)
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

    return {
      episodes: (data.number_of_episodes as number) ?? null,
      seasons: (data.number_of_seasons as number) ?? null,
      episodeRuntime,
      creator,
      networks,
      rating: (data.vote_average as number) ?? null,
    }
  } catch {
    return { episodes: null, seasons: null, episodeRuntime: null, creator: null, networks: null, rating: null }
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
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publisher&limit=6`
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

export async function fetchOpenLibraryDetails(id: string): Promise<{ author: string | null; publisher: string | null }> {
  try {
    const res = await fetch(`https://openlibrary.org${id}.json`)
    const data = await res.json()
    const author = data.authors?.[0]?.name ?? null
    const publisher = Array.isArray(data.publishers) ? data.publishers[0] : null
    return { author, publisher }
  } catch {
    return { author: null, publisher: null }
  }
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
      rating: (m.score as number) ?? null,
      source: 'jikan',
    }
  })
}

export async function fetchJikanDetails(id: string): Promise<{ author: string | null; rating: number | null; chapters: number | null }> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/manga/${id}`)
    const data = await res.json()
    const mangaData = data.data as Record<string, unknown>
    const authors = mangaData.authors as Record<string, unknown>[] | undefined
    const author = authors?.[0] ? (authors[0] as Record<string, string>).name : null
    const rating = (mangaData.score as number) ?? null
    const chapters = (mangaData.chapters as number) ?? null
    return { author, rating, chapters }
  } catch {
    return { author: null, rating: null, chapters: null }
  }
}
