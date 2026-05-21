import type { TournamentTCG } from '../types/tournament'
import { deckRuleConfigs } from './deckRules'

export interface ImportedDeckCard {
  id: string
  cardId: string
  name: string
  subtitle?: string
  imageUrl?: string
  kind?: string
  section: string
  quantity: number
}

export interface DeckImportResult {
  cards: ImportedDeckCard[]
  ignoredLines: string[]
}

type ParsedLine = {
  quantity: number
  name: string
  cardCode?: string
  metadata?: Partial<Pick<ImportedDeckCard, 'cardId' | 'imageUrl' | 'subtitle' | 'kind'>>
}

const sectionAliases: Record<TournamentTCG, Record<string, string>> = {
  magic: {
    deck: 'Main',
    main: 'Main',
    'main deck': 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    side: 'Sideboard',
    sideboard: 'Sideboard',
    banquillo: 'Sideboard',
    reserva: 'Sideboard',
    commander: 'Main',
    companion: 'Sideboard',
  },
  yugioh: {
    main: 'Main',
    'main deck': 'Main',
    monster: 'Main',
    monsters: 'Main',
    monstruo: 'Main',
    monstruos: 'Main',
    spell: 'Main',
    spells: 'Main',
    magia: 'Main',
    magias: 'Main',
    trap: 'Main',
    traps: 'Main',
    trampa: 'Main',
    trampas: 'Main',
    extra: 'Extra',
    'extra deck': 'Extra',
    side: 'Side',
    'side deck': 'Side',
    banquillo: 'Side',
  },
  pokemon: {
    pokemon: 'Pokemon',
    trainer: 'Trainers',
    trainers: 'Trainers',
    'trainer cards': 'Trainers',
    entrenador: 'Trainers',
    entrenadores: 'Trainers',
    energy: 'Energy',
    energia: 'Energy',
  },
  lorcana: {
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    cards: 'Main',
    cartas: 'Main',
  },
  riftbound: {
    legend: 'Legend',
    leyenda: 'Legend',
    champion: 'Champion',
    campeon: 'Champion',
    chosen: 'Champion',
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    rune: 'Rune',
    runes: 'Rune',
    'rune deck': 'Rune',
    runas: 'Rune',
    'mazo de runas': 'Rune',
    battlefield: 'Battlefield',
    battlefields: 'Battlefield',
    campo: 'Battlefield',
    'campos de batalla': 'Battlefield',
    side: 'Sideboard',
    sideboard: 'Sideboard',
    banquillo: 'Sideboard',
  },
  'one-piece': {
    leader: 'Leader',
    lider: 'Leader',
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    character: 'Main',
    event: 'Main',
    stage: 'Main',
  },
}

export function parseDeckImport(game: TournamentTCG, list: string): DeckImportResult {
  if (looksLikeYdk(list)) return parseYdk(list)

  const fallbackSection = getFallbackSection(game)
  const cards: ImportedDeckCard[] = []
  const ignoredLines: string[] = []
  let section = fallbackSection

  for (const rawLine of list.split(/\r?\n/)) {
    const line = normalizeLine(rawLine)
    if (!line || shouldIgnoreLine(line)) continue

    const nextSection = getSectionFromLine(game, line)
    if (nextSection) {
      section = nextSection
      continue
    }

    const parsed = parseCardLine(game, line)
    if (!parsed) {
      ignoredLines.push(rawLine.trim())
      continue
    }

    const forcedSection = getForcedSection(game, section)
    cards.push({
      ...createImportedCard(parsed.name, parsed.quantity, forcedSection, parsed.cardCode),
      ...parsed.metadata,
    })
  }

  return { cards: mergeImportedCards(cards), ignoredLines }
}

export function parseSavedDeckCards(game: TournamentTCG, list: string): ImportedDeckCard[] {
  return parseDeckImport(game, list).cards
}

export function formatDeckCards(cards: ImportedDeckCard[], sections: string[], includeMetadata = false) {
  return sections
    .map(section => {
      const sectionCards = cards.filter(card => card.section === section)
      if (!sectionCards.length) return ''
      return [
        `${section}:`,
        ...sectionCards.map(card => `${card.quantity} ${formatDeckCardLine(card, includeMetadata)}`),
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

function parseYdk(list: string): DeckImportResult {
  const cards: ImportedDeckCard[] = []
  let section = 'Main'

  for (const rawLine of list.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#created')) continue
    if (line === '#main') {
      section = 'Main'
      continue
    }
    if (line === '#extra') {
      section = 'Extra'
      continue
    }
    if (line === '!side') {
      section = 'Side'
      continue
    }
    if (/^\d+$/.test(line)) {
      cards.push(createImportedCard(`Carta ${line}`, 1, section, line))
    }
  }

  return { cards: mergeImportedCards(cards), ignoredLines: [] }
}

function getFallbackSection(game: TournamentTCG) {
  return deckRuleConfigs[game].sections.find(section => section.id === 'Main')?.id ?? deckRuleConfigs[game].sections[0].id
}

function looksLikeYdk(list: string) {
  return /^#main$/m.test(list) || /^#extra$/m.test(list) || /^!side$/m.test(list)
}

function normalizeLine(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^\*+\s*|\s*\*+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldIgnoreLine(line: string) {
  const lower = line.toLowerCase()
  return (
    lower.startsWith('//') ||
    lower.startsWith('#created') ||
    lower.startsWith('total cards') ||
    lower.startsWith('total:') ||
    lower.includes('deck list generated')
  )
}

function getSectionFromLine(game: TournamentTCG, line: string) {
  const clean = line
    .replace(/\s*[-:]\s*\d+\s*$/g, '')
    .replace(/:$/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return sectionAliases[game][clean]
}

function parseCardLine(game: TournamentTCG, line: string): ParsedLine | null {
  const quantityFirst = line.match(/^(\d+)\s*x?\s+(.+)$/i)
  const quantityWithX = line.match(/^(\d+)\s*x\s*(.+)$/i)
  const quantityLast = line.match(/^(.+?)\s+x\s*(\d+)$/i)

  const quantity = Number(quantityWithX?.[1] ?? quantityFirst?.[1] ?? quantityLast?.[2] ?? 1)
  const rawName = quantityWithX?.[2] ?? quantityFirst?.[2] ?? quantityLast?.[1] ?? line
  const cleaned = cleanCardName(game, rawName)
  if (!cleaned.name) return null
  return { quantity, ...cleaned }
}

function cleanCardName(game: TournamentTCG, rawName: string): { name: string; cardCode?: string; metadata?: ParsedLine['metadata'] } {
  let name = rawName.trim()
  let cardCode: string | undefined

  const metadataMatch = name.match(/^(.*?)\s+\[(.+?)\]$/)
  if (metadataMatch) {
    const metadata = parseCardMetadata(metadataMatch[2])
    return {
      name: metadataMatch[1].trim(),
      cardCode: metadata.cardId,
      metadata,
    }
  }

  if (game === 'magic' || game === 'lorcana') {
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)\s+\d+[a-z]?$/i, '')
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)$/i, '')
    name = name.replace(/\s+\*F\*$/i, '')
  }

  if (game === 'pokemon') {
    name = name.replace(/\s+[A-Z]{2,5}\s+\d+[a-z]?$/i, '')
  }

  if (game === 'one-piece') {
    const codeMatch = name.match(/\b([A-Z]{2,4}\d{2}-\d{3}[a-z]?)\b/i)
    if (codeMatch) {
      cardCode = codeMatch[1].toUpperCase()
      name = name.replace(codeMatch[0], '').replace(/^[-:]\s*/, '').trim()
      if (!name) name = cardCode
    }
  }

  return { name: name.trim(), cardCode }
}

function getForcedSection(game: TournamentTCG, currentSection: string) {
  if (game === 'one-piece' && currentSection !== 'Leader') return 'Main'
  if (game === 'pokemon') return currentSection
  if (game === 'yugioh') return currentSection
  return currentSection
}

function createImportedCard(name: string, quantity: number, section: string, cardCode?: string): ImportedDeckCard {
  const cardId = cardCode ? `import:${cardCode}` : `import:${section}:${name.toLowerCase()}`
  return {
    id: crypto.randomUUID(),
    cardId,
    name,
    section,
    quantity,
  }
}

function mergeImportedCards(cards: ImportedDeckCard[]) {
  const merged = new Map<string, ImportedDeckCard>()
  for (const card of cards) {
    const key = `${card.section}:${card.cardId}:${card.name.toLowerCase()}`
    const existing = merged.get(key)
    if (existing) {
      existing.quantity += card.quantity
    } else {
      merged.set(key, { ...card })
    }
  }
  return [...merged.values()]
}

function formatDeckCardLine(card: ImportedDeckCard, includeMetadata: boolean) {
  if (!includeMetadata) return card.name
  const metadata = [
    `id=${encodeURIComponent(card.cardId)}`,
    card.imageUrl ? `img=${encodeURIComponent(card.imageUrl)}` : '',
    card.subtitle ? `sub=${encodeURIComponent(card.subtitle)}` : '',
    card.kind ? `kind=${encodeURIComponent(card.kind)}` : '',
  ].filter(Boolean).join('|')

  return metadata ? `${card.name} [${metadata}]` : card.name
}

function parseCardMetadata(value: string) {
  return Object.fromEntries(
    value.split('|').map(part => {
      const [key, raw = ''] = part.split('=')
      return [key === 'id' ? 'cardId' : key === 'img' ? 'imageUrl' : key === 'sub' ? 'subtitle' : key, decodeURIComponent(raw)]
    })
  ) as Partial<Pick<ImportedDeckCard, 'cardId' | 'imageUrl' | 'subtitle' | 'kind'>>
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
