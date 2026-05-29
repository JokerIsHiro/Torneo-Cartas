import type { CardSuggestion } from './cardSearch'
import { displayImageUrl } from '../utils/imageExport'
import { extractOnePieceCardCode, isOnePieceCardCode, ONE_PIECE_CARD_CODE_PATTERN } from '../utils/onePieceCardCode'

const OPTCG_API_BASE = 'https://www.optcgapi.com/api'
const optcgRowsCache = new Map<string, Promise<OptcgCardRow[]>>()
const optcgNameCache = new Map<string, Promise<CardSuggestion[]>>()

type OptcgCardRow = {
  card_set_id: string
  card_name: string
  set_name?: string
  set_id?: string
  card_type?: string
  card_color?: string
  rarity?: string
  card_image?: string | null
  card_image_id?: string
}

function cleanCardName(rawName: string, cardSetId: string) {
  let name = rawName.trim()
  name = name.replace(new RegExp(`\\s*\\(${cardSetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'gi'), '')
  name = name.replace(/\s*\(Alternate Art\)\s*/gi, '')
  name = name.replace(/\s*\(Manga(?: Rare)?\)\s*/gi, '')
  name = name.replace(/\s*\(\d{3}\)\s*$/, '').trim()
  return name || rawName.trim()
}

function pickBaseVariant(rows: OptcgCardRow[]) {
  if (!rows.length) return null
  const candidatesWithImage = rows.filter(row => Boolean(row.card_image))
  const candidates = candidatesWithImage.length ? candidatesWithImage : rows
  return (
    candidates.find(row => row.card_image_id === row.card_set_id) ??
    candidates.find(row => !row.card_name.toLowerCase().includes('alternate art') && !row.card_image_id?.includes('_p')) ??
    candidates[0]
  )
}

async function fetchOptcgRows(cardSetId: string): Promise<OptcgCardRow[]> {
  const cacheKey = cardSetId.toUpperCase()
  const cached = optcgRowsCache.get(cacheKey)
  if (cached) return cached

  const request = fetchOptcgRowsUncached(cardSetId)
  optcgRowsCache.set(cacheKey, request)
  return request
}

async function fetchOptcgRowsUncached(cardSetId: string): Promise<OptcgCardRow[]> {
  const endpoints = [
    `${OPTCG_API_BASE}/sets/card/${encodeURIComponent(cardSetId)}/`,
    `${OPTCG_API_BASE}/decks/card/${encodeURIComponent(cardSetId)}/`,
    `${OPTCG_API_BASE}/promos/card/${encodeURIComponent(cardSetId)}/`,
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })
      if (!response.ok) continue
      const payload = await response.json() as OptcgCardRow[] | { value?: OptcgCardRow[] }
      const rows = Array.isArray(payload) ? payload : payload.value ?? []
      if (rows.length) return rows
    } catch {
      // Siguiente endpoint: set, structure deck o promo.
    }
  }

  return []
}

export function onePieceCardToSuggestion(row: OptcgCardRow): CardSuggestion {
  const code = row.card_set_id.toUpperCase()
  const edition = [row.set_name, row.set_id].filter(Boolean).join(' · ')
  return {
    id: `one-piece:${code}`,
    name: cleanCardName(row.card_name, code),
    subtitle: edition || code,
    imageUrl: displayImageUrl(row.card_image ?? undefined),
    artUrl: displayImageUrl(row.card_image ?? undefined),
    kind: [row.card_type, row.card_color, row.rarity].filter(Boolean).join(' · '),
    text: undefined,
  }
}

export function getOnePieceSectionFromKind(kind?: string) {
  const normalized = (kind ?? '').toLowerCase()
  if (normalized.includes('leader') || normalized.includes('lider')) return 'Leader'
  return 'Main'
}

export async function searchOnePieceCardsByName(name: string, signal?: AbortSignal): Promise<CardSuggestion[]> {
  const term = name.replace(ONE_PIECE_CARD_CODE_PATTERN, '').trim() || name.trim()
  if (term.length < 2) return []
  const cacheKey = term.toLowerCase()
  const cached = optcgNameCache.get(cacheKey)
  if (cached) return cached

  const request = searchOnePieceCardsByNameUncached(term, signal)
  optcgNameCache.set(cacheKey, request)
  return request
}

async function searchOnePieceCardsByNameUncached(term: string, signal?: AbortSignal): Promise<CardSuggestion[]> {
  const rows = (
    await Promise.all(
      ['sets', 'decks', 'promos'].map(async collection => {
        const url = new URL(`${OPTCG_API_BASE}/${collection}/filtered/`)
        url.searchParams.set('card_name', term)

        try {
          const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
          if (!response.ok) return []
          const payload = await response.json() as OptcgCardRow[] | { value?: OptcgCardRow[] }
          return Array.isArray(payload) ? payload : payload.value ?? []
        } catch {
          return []
        }
      }),
    )
  ).flat()

  const byCode = new Map<string, OptcgCardRow[]>()
  for (const row of rows) {
    const key = row.card_set_id.toUpperCase()
    byCode.set(key, [...(byCode.get(key) ?? []), row])
  }

  return [...byCode.values()]
    .map(pickBaseVariant)
    .filter((row): row is OptcgCardRow => Boolean(row))
    .sort((a, b) => Number(Boolean(b.card_image)) - Number(Boolean(a.card_image)))
    .slice(0, 12)
    .map(onePieceCardToSuggestion)
}

export async function fetchOnePieceCardByCode(code: string): Promise<CardSuggestion | null> {
  const cardSetId = extractOnePieceCardCode(code) ?? (isOnePieceCardCode(code) ? code.toUpperCase() : null)
  if (!cardSetId) return null

  const rows = await fetchOptcgRows(cardSetId)
  const match = pickBaseVariant(rows)
  if (!match) return null

  return onePieceCardToSuggestion(match)
}

export async function resolveOnePieceCard(card: { cardId: string; name: string }): Promise<CardSuggestion | null> {
  const fromId = extractOnePieceCardCode(card.cardId) ?? extractOnePieceCardCode(card.name)
  if (fromId) {
    const byCode = await fetchOnePieceCardByCode(fromId)
    return byCode
  }

  const name = card.name.replace(ONE_PIECE_CARD_CODE_PATTERN, '').trim()
  if (name.length < 2) return null

  const matches = await searchOnePieceCardsByName(name)
  const exact = matches.find(candidate => candidate.name.toLowerCase() === name.toLowerCase())
  return exact ?? matches[0] ?? null
}
