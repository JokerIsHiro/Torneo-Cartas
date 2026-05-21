import type { TournamentTCG } from '../types/tournament'

export interface CardSuggestion {
  id: string
  name: string
  subtitle?: string
  imageUrl?: string
  kind?: string
}

export interface CardSearchFilters {
  kind?: string
  onlyImages?: boolean
  exact?: boolean
}

export async function searchCards(
  game: TournamentTCG,
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {}
): Promise<CardSuggestion[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const cards = await (() => {
    if (game === 'magic') return searchMagic(term, signal, filters)
    if (game === 'pokemon') return searchPokemon(term, signal, filters)
    if (game === 'yugioh') return searchYugioh(term, signal, filters)
    if (game === 'lorcana') return searchLorcana(term, signal, filters)
    return Promise.resolve([])
  })()

  return filters.onlyImages ? cards.filter(card => card.imageUrl) : cards
}

export function getCardFilterOptions(game: TournamentTCG): Array<{ label: string; value: string }> {
  if (game === 'magic') {
    return [
      { label: 'Todas', value: '' },
      { label: 'Criaturas', value: 'creature' },
      { label: 'Instantaneos', value: 'instant' },
      { label: 'Conjuros', value: 'sorcery' },
      { label: 'Artefactos', value: 'artifact' },
      { label: 'Encantamientos', value: 'enchantment' },
      { label: 'Tierras', value: 'land' },
    ]
  }

  if (game === 'pokemon') {
    return [
      { label: 'Todas', value: '' },
      { label: 'Pokemon', value: 'pokemon' },
      { label: 'Trainer', value: 'trainer' },
      { label: 'Energy', value: 'energy' },
    ]
  }

  if (game === 'yugioh') {
    return [
      { label: 'Todas', value: '' },
      { label: 'Monstruos', value: 'monster' },
      { label: 'Magias', value: 'spell' },
      { label: 'Trampas', value: 'trap' },
    ]
  }

  if (game === 'lorcana') {
    return [
      { label: 'Todas', value: '' },
      { label: 'Personajes', value: 'character' },
      { label: 'Acciones', value: 'action' },
      { label: 'Canciones', value: 'song' },
      { label: 'Objetos', value: 'item' },
      { label: 'Lugares', value: 'location' },
    ]
  }

  return []
}

async function searchMagic(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://api.scryfall.com/cards/search')
  const typeQuery = filters.kind ? ` t:${filters.kind}` : ''
  url.searchParams.set('q', `${query}${typeQuery}`)
  url.searchParams.set('unique', 'cards')
  url.searchParams.set('order', 'name')
  url.searchParams.set('include_extras', 'false')

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return []

  const payload = await response.json() as {
    data?: Array<{
      id: string
      name: string
      set_name?: string
      type_line?: string
      image_uris?: { small?: string; normal?: string }
      card_faces?: Array<{ image_uris?: { small?: string; normal?: string } }>
    }>
  }

  return uniqueCards((payload.data ?? []).map(card => ({
    id: `magic:${card.id}`,
    name: card.name,
    subtitle: card.set_name,
    imageUrl: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small,
    kind: card.type_line,
  }))).slice(0, 12)
}

async function searchPokemon(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://api.pokemontcg.io/v2/cards')
  const supertype = filters.kind ? ` supertype:${filters.kind}` : ''
  url.searchParams.set('q', `name:${escapePokemonQuery(query)}*${supertype}`)
  url.searchParams.set('pageSize', '10')
  url.searchParams.set('orderBy', 'name')
  url.searchParams.set('select', 'id,name,set,images')

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return []

  const payload = await response.json() as {
    data?: Array<{ id: string; name: string; set?: { name?: string }; images?: { small?: string } }>
  }

  return (payload.data ?? []).map(card => ({
    id: `pokemon:${card.id}`,
    name: card.name,
    subtitle: card.set?.name,
    imageUrl: card.images?.small,
    kind: filters.kind,
  })).slice(0, 12)
}

async function searchYugioh(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php')
  url.searchParams.set(filters.exact ? 'name' : 'fname', query)

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return []

  const payload = await response.json() as {
    data?: Array<{ id: number; name: string; type?: string; card_images?: Array<{ image_url?: string; image_url_small?: string }> }>
  }

  const cards = uniqueCards((payload.data ?? []).map(card => ({
    id: `yugioh:${card.id}`,
    name: card.name,
    subtitle: card.type,
    imageUrl: proxiedImageUrl(card.card_images?.[0]?.image_url ?? card.card_images?.[0]?.image_url_small),
    kind: card.type,
  })))

  return filterYugiohCards(cards, filters.kind).slice(0, 12)
}

async function searchLorcana(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://api.lorcast.com/v0/cards/search')
  const typeQuery = filters.kind ? ` type:${filters.kind}` : ''
  url.searchParams.set('q', `${query}${typeQuery}`)

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return []

  const payload = await response.json() as {
    results?: Array<{
      id: string
      name: string
      version?: string
      set?: { name?: string }
      image_uris?: { digital?: { small?: string; normal?: string } }
    }>
  }

  return uniqueCards((payload.results ?? []).map(card => ({
    id: `lorcana:${card.id}`,
    name: card.version ? `${card.name} - ${card.version}` : card.name,
    subtitle: card.set?.name,
    imageUrl: card.image_uris?.digital?.small,
    kind: filters.kind,
  }))).slice(0, 12)
}

function filterYugiohCards(cards: CardSuggestion[], kind?: string) {
  if (!kind) return cards
  return cards.filter(card => card.subtitle?.toLowerCase().includes(kind))
}

function escapePokemonQuery(query: string) {
  return query.replace(/[\\"]/g, '')
}

function uniqueCards(cards: CardSuggestion[]) {
  const seen = new Set<string>()
  return cards.filter(card => {
    const key = card.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function proxiedImageUrl(url?: string) {
  if (!url) return undefined
  if (!url.includes('ygoprodeck.com')) return url
  const cleanUrl = url.replace(/^https?:\/\//, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`
}
