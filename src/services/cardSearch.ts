import type { TournamentTCG } from '../types/tournament'
import { proxiedImageUrl } from '../utils/imageExport'
import { extractOnePieceCardCode } from '../utils/onePieceCardCode'
import { fetchOnePieceCardByCode, searchOnePieceCardsByName } from './optcgApi'

export interface CardSuggestion {
  id: string
  name: string
  subtitle?: string
  imageUrl?: string
  kind?: string
  text?: string
  legalities?: Record<string, string>
}

export interface CardSearchFilters {
  kind?: string
  color?: string
  attribute?: string
  cardType?: string
  onlyImages?: boolean
  exact?: boolean
  text?: string
  format?: string
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
    if (game === 'one-piece') return searchOnePiece(term, signal, filters)
    if (game === 'riftbound') return searchRiftbound(term, signal, filters)
    return Promise.resolve([])
  })()

  if (!cards.length || (filters.onlyImages && !cards.some(card => card.imageUrl))) {
    const fallback = await searchApiTcg(game, term, signal, filters).catch(() => [])
    const combined = uniqueCards([...cards, ...fallback])
    return filters.onlyImages ? combined.filter(card => card.imageUrl) : combined
  }

  return filters.onlyImages ? uniqueCards(cards).filter(card => card.imageUrl) : uniqueCards(cards)
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

export function getAdvancedCardFilterOptions(game: TournamentTCG): Array<{
  key: 'color' | 'attribute' | 'cardType'
  label: string
  options: Array<{ label: string; value: string }>
}> {
  if (game === 'magic') {
    return [{
      key: 'color',
      label: 'Color',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Blanco', value: 'w' },
        { label: 'Azul', value: 'u' },
        { label: 'Negro', value: 'b' },
        { label: 'Rojo', value: 'r' },
        { label: 'Verde', value: 'g' },
        { label: 'Incoloro', value: 'c' },
      ],
    }]
  }

  if (game === 'pokemon') {
    return [{
      key: 'cardType',
      label: 'Tipo Pokemon',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Grass', value: 'Grass' },
        { label: 'Fire', value: 'Fire' },
        { label: 'Water', value: 'Water' },
        { label: 'Lightning', value: 'Lightning' },
        { label: 'Psychic', value: 'Psychic' },
        { label: 'Fighting', value: 'Fighting' },
        { label: 'Darkness', value: 'Darkness' },
        { label: 'Metal', value: 'Metal' },
        { label: 'Dragon', value: 'Dragon' },
        { label: 'Colorless', value: 'Colorless' },
      ],
    }]
  }

  if (game === 'yugioh') {
    return [
      {
        key: 'attribute',
        label: 'Atributo',
        options: [
          { label: 'Todos', value: '' },
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
          { label: 'Fire', value: 'fire' },
          { label: 'Water', value: 'water' },
          { label: 'Earth', value: 'earth' },
          { label: 'Wind', value: 'wind' },
          { label: 'Divine', value: 'divine' },
        ],
      },
      {
        key: 'cardType',
        label: 'Tipo monstruo',
        options: [
          { label: 'Todos', value: '' },
          { label: 'Dragon', value: 'dragon' },
          { label: 'Spellcaster', value: 'spellcaster' },
          { label: 'Warrior', value: 'warrior' },
          { label: 'Beast', value: 'beast' },
          { label: 'Machine', value: 'machine' },
          { label: 'Fiend', value: 'fiend' },
          { label: 'Fairy', value: 'fairy' },
          { label: 'Zombie', value: 'zombie' },
        ],
      },
    ]
  }

  if (game === 'lorcana') {
    return [{
      key: 'color',
      label: 'Tinta',
      options: [
        { label: 'Todas', value: '' },
        { label: 'Amber', value: 'amber' },
        { label: 'Amethyst', value: 'amethyst' },
        { label: 'Emerald', value: 'emerald' },
        { label: 'Ruby', value: 'ruby' },
        { label: 'Sapphire', value: 'sapphire' },
        { label: 'Steel', value: 'steel' },
      ],
    }]
  }

  return []
}

async function searchMagic(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  if (filters.exact && !filters.kind && !filters.color && !filters.text?.trim()) {
    const exactUrl = new URL('https://api.scryfall.com/cards/named')
    exactUrl.searchParams.set('exact', query)
    const exactResponse = await fetch(exactUrl, { signal, headers: { Accept: 'application/json' } })
    if (exactResponse.ok) {
      const card = await exactResponse.json() as {
        id: string
        name: string
        set_name?: string
        type_line?: string
        oracle_text?: string
        legalities?: Record<string, string>
        image_uris?: { small?: string; normal?: string }
        card_faces?: Array<{ oracle_text?: string; image_uris?: { small?: string; normal?: string } }>
      }
      return [{
        id: `magic:${card.id}`,
        name: card.name,
        subtitle: card.set_name,
        imageUrl: proxiedImageUrl(card.image_uris?.normal ?? card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.small),
        kind: card.type_line,
        text: card.oracle_text ?? card.card_faces?.map(face => face.oracle_text).filter(Boolean).join('\n'),
        legalities: card.legalities,
      }]
    }
  }

  const url = new URL('https://api.scryfall.com/cards/search')
  const baseQuery = filters.exact ? `!"${escapeScryfallQuery(query)}"` : query
  const typeQuery = filters.kind ? ` t:${filters.kind}` : ''
  const colorQuery = filters.color ? ` c:${filters.color}` : ''
  const formatQuery = filters.format ? ` f:${filters.format}` : ''
  const textQuery = filters.text?.trim() ? ` o:"${escapeScryfallQuery(filters.text.trim())}"` : ''
  url.searchParams.set('q', `${baseQuery}${typeQuery}${colorQuery}${formatQuery}${textQuery}`)
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
      oracle_text?: string
      legalities?: Record<string, string>
      image_uris?: { small?: string; normal?: string }
      card_faces?: Array<{ oracle_text?: string; image_uris?: { small?: string; normal?: string } }>
    }>
  }

  return uniqueCards((payload.data ?? []).map(card => ({
    id: `magic:${card.id}`,
    name: card.name,
    subtitle: card.set_name,
    imageUrl: proxiedImageUrl(card.image_uris?.normal ?? card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.small),
    kind: card.type_line,
    text: card.oracle_text ?? card.card_faces?.map(face => face.oracle_text).filter(Boolean).join('\n'),
    legalities: card.legalities,
  }))).slice(0, 12)
}

async function searchPokemon(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://api.pokemontcg.io/v2/cards')
  const supertype = filters.kind ? ` supertype:${filters.kind}` : ''
  const type = filters.cardType ? ` types:${filters.cardType}` : ''
  const nameQuery = filters.exact ? `name:"${escapePokemonQuery(query)}"` : `name:${escapePokemonQuery(query)}*`
  url.searchParams.set('q', `${nameQuery}${supertype}${type}`)
  url.searchParams.set('pageSize', filters.exact ? '250' : '40')
  url.searchParams.set('orderBy', '-set.releaseDate,name')
  url.searchParams.set('select', 'id,name,set,images,rarity,tcgplayer,rules,attacks,abilities')

  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return []

  const payload = await response.json() as {
    data?: Array<{
      id: string
      name: string
      set?: { name?: string; releaseDate?: string }
      types?: string[]
      images?: { small?: string; large?: string }
      rarity?: string
      tcgplayer?: { prices?: Record<string, { market?: number; low?: number; mid?: number }> }
      rules?: string[]
      attacks?: Array<{ text?: string }>
      abilities?: Array<{ text?: string }>
    }>
  }

  return filterByText(sortPokemonPrintings(payload.data ?? []).map(card => ({
    id: `pokemon:${card.id}`,
    name: card.name,
    subtitle: [card.set?.name, card.rarity].filter(Boolean).join(' - '),
    imageUrl: proxiedImageUrl(card.images?.large ?? card.images?.small),
    kind: card.types?.join(', ') ?? filters.kind,
    text: [
      ...(card.rules ?? []),
      ...(card.attacks ?? []).map(attack => attack.text ?? ''),
      ...(card.abilities ?? []).map(ability => ability.text ?? ''),
    ].filter(Boolean).join('\n'),
  })), filters.text).slice(0, 12)
}

type PokemonPrinting = {
  id: string
  name: string
  set?: { name?: string; releaseDate?: string }
  types?: string[]
  images?: { small?: string; large?: string }
  rarity?: string
  tcgplayer?: { prices?: Record<string, { market?: number; low?: number; mid?: number }> }
  rules?: string[]
  attacks?: Array<{ text?: string }>
  abilities?: Array<{ text?: string }>
}

function sortPokemonPrintings(cards: PokemonPrinting[]) {
  return [...cards].sort((a, b) => {
    const rarityScore = getPokemonRarityScore(a) - getPokemonRarityScore(b)
    if (rarityScore !== 0) return rarityScore

    const dateScore = getPokemonReleaseTime(b) - getPokemonReleaseTime(a)
    if (dateScore !== 0) return dateScore

    return getPokemonPrice(a) - getPokemonPrice(b)
  })
}

function getPokemonRarityScore(card: PokemonPrinting) {
  const text = `${card.id} ${card.rarity ?? ''}`.toLowerCase()
  if (/promo|secret|rainbow|hyper|shiny|illustration|special|trainer gallery|gold|rare holo vmax|rare holo vstar|rare ultra|rare secret/.test(text)) return 3
  if (/rare holo|double rare|ace spec|amazing rare|radiant/.test(text)) return 2
  if (/rare/.test(text)) return 1
  return 0
}

function getPokemonReleaseTime(card: PokemonPrinting) {
  const raw = card.set?.releaseDate
  const time = raw ? Date.parse(raw) : 0
  return Number.isFinite(time) ? time : 0
}

function getPokemonPrice(card: PokemonPrinting) {
  const values = Object.values(card.tcgplayer?.prices ?? {})
    .flatMap(price => [price.market, price.low, price.mid])
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price))
  return values.length ? Math.min(...values) : Number.MAX_SAFE_INTEGER
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
    data?: Array<{ id: number; name: string; type?: string; race?: string; attribute?: string; desc?: string; card_images?: Array<{ image_url?: string; image_url_small?: string }> }>
  }

  const cards = filterByText(uniqueCards((payload.data ?? []).map(card => ({
    id: `yugioh:${card.id}`,
    name: card.name,
    subtitle: card.type,
    imageUrl: proxiedImageUrl(card.card_images?.[0]?.image_url ?? card.card_images?.[0]?.image_url_small),
    kind: [card.type, card.race, card.attribute].filter(Boolean).join(' · '),
    text: card.desc,
  }))), filters.text)

  return filterYugiohCards(cards, filters).slice(0, 12)
}

async function searchLorcana(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://api.lorcast.com/v0/cards/search')
  const typeQuery = filters.kind ? ` type:${filters.kind}` : ''
  const colorQuery = filters.color ? ` ink:${filters.color}` : ''
  url.searchParams.set('q', `${query}${typeQuery}${colorQuery}`)
  url.searchParams.set('unique', 'prints')

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
      type?: string[]
      ink?: string
      text?: string
      fullText?: string
      set?: { name?: string }
      image_uris?: { digital?: { small?: string; normal?: string; large?: string } }
    }>
  }

  return filterByText(uniqueCards((payload.results ?? []).map(card => ({
    id: `lorcana:${card.id}`,
    name: card.version ? `${card.name} - ${card.version}` : card.name,
    subtitle: card.set?.name,
    imageUrl: proxiedImageUrl(card.image_uris?.digital?.large ?? card.image_uris?.digital?.normal ?? card.image_uris?.digital?.small),
    kind: [card.type?.join(', '), card.ink].filter(Boolean).join(' - '),
    text: card.fullText ?? card.text,
  }))), filters.text).slice(0, 12)
}

async function searchOnePiece(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const code = extractOnePieceCardCode(query)
  if (code) {
    const byCode = await fetchOnePieceCardByCode(code)
    if (byCode && (!filters.onlyImages || byCode.imageUrl)) {
      if (!filters.exact || byCode.name.toLowerCase().includes(query.toLowerCase()) || query.toUpperCase() === code) {
        return [byCode]
      }
    }
  }

  const optcgCards = await searchOnePieceCardsByName(query, signal)
  if (optcgCards.length) {
    const cards = filters.onlyImages ? optcgCards.filter(card => card.imageUrl) : optcgCards
    if (cards.length) return uniqueCards(cards)
  }

  const scrydexCards = await searchScrydex('onepiece', query, signal, filters).catch(() => [])
  if (scrydexCards.length) return scrydexCards
  return searchApiTcg('one-piece', query, signal, filters)
}

async function searchRiftbound(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const riftScribeCards = await searchRiftScribe(query, signal, filters).catch(() => [])
  if (riftScribeCards.some(card => card.imageUrl)) return riftScribeCards

  const scrydexCards = await searchScrydex('riftbound', query, signal, filters).catch(() => [])
  if (scrydexCards.length) return uniqueCards([...riftScribeCards, ...scrydexCards])
  return searchApiTcg('riftbound', query, signal, filters)
}

async function searchScrydex(
  gameSlug: 'onepiece' | 'riftbound',
  query: string,
  signal?: AbortSignal,
  filters: CardSearchFilters = {}
): Promise<CardSuggestion[]> {
  const url = new URL(`https://api.scrydex.com/${gameSlug}/v1/cards`)
  const code = extractCardCode(query)
  url.searchParams.set('page_size', filters.exact ? '20' : '40')
  url.searchParams.set('q', code ? `id:${code}` : `name:${query}*`)

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) return []

  const payload = await response.json() as ScrydexListResponse | ScrydexCard[]
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? []
  const game = gameSlug === 'onepiece' ? 'one-piece' : 'riftbound'

  return filterByText(rows.map(card => ({
    id: `${game}:${card.id ?? card.printed_number ?? card.number ?? card.name}`,
    name: card.name ?? '',
    subtitle: [card.printed_number ?? card.number, card.expansion?.code ?? card.expansion?.id, card.rarity].filter(Boolean).join(' - '),
    imageUrl: proxiedImageUrl(firstImage(card)),
    kind: [card.type, card.domain, card.attribute, card.colors?.join(', '), card.subtypes?.join(', ')].filter(Boolean).join(' - '),
    text: card.rules?.join('\n'),
  })).filter(card => card.name), filters.text)
    .filter(card => !filters.exact || card.name.toLowerCase() === query.toLowerCase() || card.id.toLowerCase().endsWith(`:${query.toLowerCase()}`))
    .slice(0, 12)
}

async function searchRiftScribe(query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const url = new URL('https://riftscribe.gg/api/cards/search')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', filters.exact ? '8' : '20')

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) return []

  const payload = await response.json() as RiftScribeListResponse | RiftScribeCard[]
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? payload.results ?? []
  return filterByText(rows.map(card => ({
    id: `riftbound:${card.id ?? card.card_id ?? card.code ?? card.name}`,
    name: card.name ?? '',
    subtitle: [card.set_id ?? card.set, card.rarity].filter(Boolean).join(' - '),
    imageUrl: proxiedImageUrl(firstImage(card)),
    kind: [card.type, card.domain, card.faction, card.region].filter(Boolean).join(' - '),
    text: Array.isArray(card.rules) ? card.rules.join('\n') : card.text ?? card.effect,
  })).filter(card => card.name), filters.text).slice(0, 12)
}

async function searchApiTcg(game: TournamentTCG, query: string, signal?: AbortSignal, filters: CardSearchFilters = {}): Promise<CardSuggestion[]> {
  const gameSlug = getApiTcgGameSlug(game)
  if (!gameSlug) return []

  const url = new URL(`https://apitcg.com/api/${gameSlug}/cards`)
  url.searchParams.set('name', query)
  url.searchParams.set('limit', filters.exact ? '12' : '20')

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) return []

  const payload = await response.json() as {
    data?: Array<{
      id?: string | number
      name?: string
      title?: string
      images?: { small?: string; large?: string; full?: string }
      image?: string
      imageUrl?: string
      type?: string
      cardType?: string
      supertype?: string
      color?: string | string[]
      colors?: string[]
      types?: string[]
      family?: string
      ability?: string
      text?: string
      effect?: string
      set?: { name?: string }
      setName?: string
    }>
  } | Array<{
    id?: string | number
    name?: string
    title?: string
    images?: { small?: string; large?: string; full?: string }
    image?: string
    imageUrl?: string
    type?: string
    cardType?: string
    supertype?: string
    color?: string | string[]
    colors?: string[]
    types?: string[]
    family?: string
    ability?: string
    text?: string
    effect?: string
    set?: { name?: string }
    setName?: string
  }>

  const rows = Array.isArray(payload) ? payload : payload.data ?? []
  return filterByText(rows.map(card => {
    const name = card.name ?? card.title ?? ''
    const rawImage = card.images?.large ?? card.images?.full ?? card.images?.small ?? card.imageUrl ?? card.image
    const kind = [
      card.supertype,
      card.type,
      card.cardType,
      Array.isArray(card.color) ? card.color.join(', ') : card.color,
      card.colors?.join(', '),
      card.types?.join(', '),
      card.family,
    ].filter(Boolean).join(' - ')
    return {
      id: `${game}:${String(card.id ?? name)}`,
      name,
      subtitle: card.set?.name ?? card.setName,
      imageUrl: proxiedImageUrl(rawImage),
      kind,
      text: card.text ?? card.effect ?? card.ability,
    }
  }).filter(card => card.name), filters.text)
    .filter(card => !filters.exact || card.name.toLowerCase() === query.toLowerCase())
    .slice(0, 12)
}

function getApiTcgGameSlug(game: TournamentTCG) {
  if (game === 'one-piece') return 'one-piece'
  if (game === 'pokemon') return 'pokemon'
  if (game === 'magic') return 'magic'
  if (game === 'riftbound') return 'riftbound'
  return ''
}

type ScrydexImage = { small?: string; medium?: string; large?: string; full?: string; url?: string }
type ScrydexCard = {
  id?: string
  name?: string
  printed_number?: string
  number?: string
  type?: string
  domain?: string
  attribute?: string
  colors?: string[]
  subtypes?: string[]
  rarity?: string
  rules?: string[]
  images?: ScrydexImage[] | Record<string, string>
  image?: string
  image_url?: string
  imageUrl?: string
  expansion?: { id?: string; code?: string; name?: string }
}

type ScrydexListResponse = {
  data?: ScrydexCard[]
  items?: ScrydexCard[]
}

type RiftScribeCard = {
  id?: string
  card_id?: string
  code?: string
  name?: string
  set?: string
  set_id?: string
  rarity?: string
  type?: string
  domain?: string
  faction?: string
  region?: string
  rules?: string[]
  text?: string
  effect?: string
  images?: ScrydexImage[] | Record<string, string>
  image?: string
  image_url?: string
  imageUrl?: string
  art_url?: string
  thumbnail_url?: string
}

type RiftScribeListResponse = {
  data?: RiftScribeCard[]
  items?: RiftScribeCard[]
  results?: RiftScribeCard[]
}

function firstImage(card: {
  images?: ScrydexImage[] | Record<string, string>
  image?: string
  image_url?: string
  imageUrl?: string
  art_url?: string
  thumbnail_url?: string
}) {
  if (Array.isArray(card.images)) {
    const image = card.images[0]
    return image?.large ?? image?.full ?? image?.medium ?? image?.small ?? image?.url
  }
  if (card.images && typeof card.images === 'object') {
    return card.images.large ?? card.images.full ?? card.images.medium ?? card.images.small
  }
  return card.imageUrl ?? card.image_url ?? card.image ?? card.art_url ?? card.thumbnail_url
}

function extractCardCode(value: string) {
  return extractOnePieceCardCode(value)
}

function filterByText(cards: CardSuggestion[], text?: string) {
  const needle = text?.trim().toLowerCase()
  if (!needle) return cards
  return cards.filter(card => card.text?.toLowerCase().includes(needle))
}

function escapeScryfallQuery(query: string) {
  return query.replace(/"/g, '\\"')
}

function filterYugiohCards(cards: CardSuggestion[], filters: CardSearchFilters) {
  return cards.filter(card => {
    const text = `${card.subtitle ?? ''} ${card.kind ?? ''}`.toLowerCase()
    if (filters.kind && !text.includes(filters.kind)) return false
    if (filters.attribute && !text.includes(filters.attribute)) return false
    if (filters.cardType && !text.includes(filters.cardType)) return false
    return true
  })
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

