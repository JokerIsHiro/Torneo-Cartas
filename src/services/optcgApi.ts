import type { CardSuggestion } from './cardSearch'
import { extractOnePieceCardCode, isOnePieceCardCode, ONE_PIECE_CARD_CODE_PATTERN } from '../utils/onePieceCardCode'

const OPTCG_API_BASE = 'https://www.optcgapi.com/api'

type OptcgCardRow = {
  card_set_id: string
  card_name: string
  set_name?: string
  set_id?: string
  card_type?: string
  card_color?: string
  rarity?: string
  card_image?: string
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
  return (
    rows.find(row => row.card_image_id === row.card_set_id) ??
    rows.find(row => !row.card_name.toLowerCase().includes('alternate art') && !row.card_image_id?.includes('_p')) ??
    rows[0]
  )
}

async function fetchOptcgRows(cardSetId: string): Promise<OptcgCardRow[]> {
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
    imageUrl: row.card_image,
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

  const url = new URL(`${OPTCG_API_BASE}/sets/filtered/`)
  url.searchParams.set('card_name', term)

  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) return []
    const payload = await response.json() as OptcgCardRow[] | { value?: OptcgCardRow[] }
    const rows = Array.isArray(payload) ? payload : payload.value ?? []
    const seen = new Set<string>()
    return rows
      .filter(row => {
        const key = row.card_set_id.toUpperCase()
        if (seen.has(key)) return false
        seen.add(key)
        return !row.card_name.toLowerCase().includes('alternate art')
      })
      .slice(0, 12)
      .map(onePieceCardToSuggestion)
  } catch {
    return []
  }
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
    if (byCode) return byCode
  }

  const name = card.name.replace(ONE_PIECE_CARD_CODE_PATTERN, '').trim()
  if (name.length < 2) return null

  const matches = await searchOnePieceCardsByName(name)
  const exact = matches.find(candidate => candidate.name.toLowerCase() === name.toLowerCase())
  return exact ?? matches[0] ?? null
}
