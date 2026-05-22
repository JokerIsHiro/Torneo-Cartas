import type { TournamentTCG } from '../types/tournament'
import { deckRuleConfigs } from './deckRules'
import { extractOnePieceCardCode, ONE_PIECE_CARD_CODE_PATTERN } from './onePieceCardCode'
import {
  normalizePasteText,
  parseDeckLine,
  shouldIgnoreDeckLine,
  tryParseJsonDecklist,
  tryParsePokemonComBlock,
  type ParsedDeckLine,
} from './deckListTextParser'

// Importador tolerante: acepta pegados desde simuladores, Limitless, Egman,
// OPTCG Sim, TCGplayer, Pokemon.com, tablas Markdown, JSON y listas sueltas.
export interface ImportedDeckCard {
  id: string
  cardId: string
  name: string
  subtitle?: string
  imageUrl?: string
  kind?: string
  legalities?: Record<string, string>
  section: string
  quantity: number
}

export interface DeckImportResult {
  cards: ImportedDeckCard[]
  ignoredLines: string[]
}

const sectionAliases: Record<TournamentTCG, Record<string, string>> = {
  magic: {
    deck: 'Main',
    main: 'Main',
    'main deck': 'Main',
    mainboard: 'Main',
    maindecks: 'Main',
    cards: 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    side: 'Sideboard',
    sideboard: 'Sideboard',
    'side board': 'Sideboard',
    banquillo: 'Sideboard',
    reserva: 'Sideboard',
    commander: 'Main',
    companion: 'Sideboard',
    creatures: 'Main',
    creature: 'Main',
    spells: 'Main',
    spell: 'Main',
    instants: 'Main',
    sorceries: 'Main',
    enchantments: 'Main',
    artifacts: 'Main',
    lands: 'Main',
    land: 'Main',
    maybeboard: 'Sideboard',
    maybe: 'Sideboard',
  },
  yugioh: {
    main: 'Main',
    'main deck': 'Main',
    '#main': 'Main',
    monster: 'Main',
    monsters: 'Main',
    monstruo: 'Main',
    monstruos: 'Main',
    spell: 'Main',
    'spell cards': 'Main',
    'spell/trap': 'Main',
    spells: 'Main',
    magia: 'Main',
    magias: 'Main',
    trap: 'Main',
    'trap cards': 'Main',
    traps: 'Main',
    trampa: 'Main',
    trampas: 'Main',
    extra: 'Extra',
    'extra deck': 'Extra',
    '#extra': 'Extra',
    'extra deck cards': 'Extra',
    side: 'Side',
    'side deck': 'Side',
    '!side': 'Side',
    'side deck cards': 'Side',
    banquillo: 'Side',
  },
  pokemon: {
    pokemon: 'Pokemon',
    pokemons: 'Pokemon',
    'pokemon cards': 'Pokemon',
    'pokémon': 'Pokemon',
    'pokémon cards': 'Pokemon',
    trainer: 'Trainers',
    trainers: 'Trainers',
    'trainer cards': 'Trainers',
    entrenador: 'Trainers',
    entrenadores: 'Trainers',
    item: 'Trainers',
    supporter: 'Trainers',
    energy: 'Energy',
    energies: 'Energy',
    'energy cards': 'Energy',
    energia: 'Energy',
    energias: 'Energy',
  },
  lorcana: {
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    cards: 'Main',
    cartas: 'Main',
    characters: 'Main',
    character: 'Main',
    actions: 'Main',
    action: 'Main',
    items: 'Main',
    item: 'Main',
    locations: 'Main',
    location: 'Main',
    songs: 'Main',
    song: 'Main',
  },
  riftbound: {
    legend: 'Legend',
    legends: 'Legend',
    leyenda: 'Legend',
    leyendas: 'Legend',
    leyend: 'Legend',
    leyends: 'Legend',
    'legend cards': 'Legend',
    champion: 'Champion',
    champions: 'Champion',
    'champion cards': 'Champion',
    campeon: 'Champion',
    campeones: 'Champion',
    chosen: 'Champion',
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mainboard: 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    rune: 'Rune',
    runes: 'Rune',
    'rune deck': 'Rune',
    'runes deck': 'Rune',
    'rune cards': 'Rune',
    runas: 'Rune',
    'mazo de runas': 'Rune',
    battlefield: 'Battlefield',
    battlefields: 'Battlefield',
    'battlefield cards': 'Battlefield',
    campo: 'Battlefield',
    'campos de batalla': 'Battlefield',
    field: 'Battlefield',
    fields: 'Battlefield',
    side: 'Sideboard',
    sideboard: 'Sideboard',
    banquillo: 'Sideboard',
  },
  'one-piece': {
    leader: 'Leader',
    leaders: 'Leader',
    lider: 'Leader',
    lideres: 'Leader',
    'leader card': 'Leader',
    'leader cards': 'Leader',
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mainboard: 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    'character deck': 'Main',
    character: 'Main',
    characters: 'Main',
    'character cards': 'Main',
    event: 'Main',
    events: 'Main',
    'event deck': 'Main',
    'event cards': 'Main',
    stage: 'Main',
    stages: 'Main',
    'stage deck': 'Main',
    'stage cards': 'Main',
    'don deck': 'Main',
    'don!! deck': 'Main',
    don: 'Main',
    'don!!': 'Main',
    'z deck': 'Main',
    'z-deck': 'Main',
  },
  chess: {},
}

export function parseDeckImport(game: TournamentTCG, list: string): DeckImportResult {
  const normalized = normalizePasteText(list)

  if (looksLikeYdk(normalized)) return parseYdk(normalized)

  const jsonLines = tryParseJsonDecklist(normalized, game)
  if (jsonLines) return linesToResult(game, jsonLines, [])

  const pokemonLines = game === 'pokemon' ? tryParsePokemonComBlock(normalized) : null
  if (pokemonLines) return linesToResult(game, pokemonLines, [])

  return parseTextLines(game, normalized)
}

export function parseSavedDeckCards(game: TournamentTCG, list: string): ImportedDeckCard[] {
  return parseDeckImport(game, list).cards
}

export function formatDeckCards(
  cards: ImportedDeckCard[],
  sections: string[],
  includeMetadata = false,
  game?: TournamentTCG,
) {
  const groupedCards = mergeImportedCards(cards)
  return sections
    .map(section => {
      const sectionCards = groupedCards.filter(card => card.section === section)
      if (!sectionCards.length) return ''
      const lines = sectionCards.map(card => `${card.quantity} ${formatDeckCardLine(card, includeMetadata, game)}`)
      if (game === 'one-piece') return lines.join('\n')
      return [`${section}:`, ...lines].join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

function parseTextLines(game: TournamentTCG, list: string): DeckImportResult {
  const fallbackSection = getFallbackSection(game)
  const cards: ImportedDeckCard[] = []
  const ignoredLines: string[] = []
  let section = fallbackSection

  for (const rawLine of list.split('\n')) {
    const line = normalizeLine(rawLine)
    if (!line || shouldIgnoreDeckLine(line)) continue

    const nextSection = getSectionFromLine(game, line)
    if (nextSection) {
      section = nextSection
      continue
    }

    const parsed = parseDeckLine(game, line)
    if (!parsed) {
      ignoredLines.push(rawLine.trim())
      continue
    }

    const targetSection = parsed.sectionHint ?? section
    const forcedSection = getForcedSection(game, targetSection, parsed)
    const cleaned = applyGameMetadata(game, parsed)

    cards.push({
      ...createImportedCard(game, cleaned.name, parsed.quantity, forcedSection, cleaned.cardCode),
      ...cleaned.metadata,
    })
  }

  return { cards: mergeImportedCards(cards), ignoredLines }
}

function linesToResult(game: TournamentTCG, lines: ParsedDeckLine[], ignoredLines: string[]): DeckImportResult {
  const cards: ImportedDeckCard[] = []

  for (const parsed of lines) {
    const section = getForcedSection(game, parsed.sectionHint ?? getFallbackSection(game), parsed)
    const cleaned = applyGameMetadata(game, parsed)
    cards.push({
      ...createImportedCard(game, cleaned.name, parsed.quantity, section, cleaned.cardCode),
      ...cleaned.metadata,
    })
  }

  return { cards: mergeImportedCards(cards), ignoredLines }
}

function parseYdk(list: string): DeckImportResult {
  const cards: ImportedDeckCard[] = []
  let section = 'Main'

  for (const rawLine of list.split('\n')) {
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
      cards.push(createImportedCard('yugioh', `Carta ${line}`, 1, section, line))
    }
  }

  return { cards: mergeImportedCards(cards), ignoredLines: [] }
}

function getFallbackSection(game: TournamentTCG) {
  return deckRuleConfigs[game].sections.find(section => section.id === 'Main')?.id ?? deckRuleConfigs[game].sections[0]?.id ?? 'Main'
}

function looksLikeYdk(list: string) {
  return /^#main$/m.test(list) || /^#extra$/m.test(list) || /^!side$/m.test(list)
}

function normalizeLine(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^#+\s*/, '')
    .replace(/^\*+\s*|\s*\*+$/g, '')
    .replace(/^\s*[-•▪►]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSectionFromLine(game: TournamentTCG, line: string) {
  const clean = line
    .replace(/\s*\(\s*\d+\s*(?:cards?|cartas?)?\s*\)\s*$/gi, '')
    .replace(/\s*\[\s*\d+\s*(?:cards?|cartas?)?\s*\]\s*$/gi, '')
    .replace(/\s*[-:]\s*\d+\s*$/g, '')
    .replace(/\s*[-:]\s*\d+\s*(?:cards?|cartas?)\s*$/gi, '')
    .replace(/\s+\d+\s*(?:cards?|cartas?)\s*$/gi, '')
    .replace(/[:：]$/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return sectionAliases[game][clean]
}

function applyGameMetadata(game: TournamentTCG, parsed: ParsedDeckLine) {
  let name = parsed.name.trim()
  let cardCode = parsed.cardCode
  let metadata: Partial<Pick<ImportedDeckCard, 'cardId' | 'imageUrl' | 'subtitle' | 'kind'>> | undefined

  const metadataMatch = name.match(/^(.*?)\s+\[(.+?)\]$/)
  if (metadataMatch) {
    metadata = parseCardMetadata(metadataMatch[2])
    return {
      name: metadataMatch[1].trim(),
      cardCode: metadata?.cardId ?? cardCode,
      metadata,
    }
  }

  if (game === 'one-piece') {
    const codeMatch = name.match(ONE_PIECE_CARD_CODE_PATTERN)
    if (codeMatch) {
      cardCode = codeMatch[1].toUpperCase()
      name = name.replace(codeMatch[0], '').replace(/^[-:]\s*/, '').trim()
      if (!name) name = cardCode
    }
  }

  return { name: name.trim(), cardCode, metadata }
}

function getForcedSection(game: TournamentTCG, currentSection: string, parsed: ParsedDeckLine) {
  if (game === 'one-piece') {
    if (currentSection === 'Leader') return 'Leader'
    if (parsed.sectionHint === 'Leader') return 'Leader'
    return 'Main'
  }
  if (game === 'pokemon') return currentSection
  if (game === 'yugioh') return currentSection
  return currentSection
}

function createImportedCard(
  game: TournamentTCG,
  name: string,
  quantity: number,
  section: string,
  cardCode?: string,
): ImportedDeckCard {
  const normalizedCode = cardCode?.toUpperCase()
  const cardId = normalizedCode
    ? game === 'one-piece'
      ? `one-piece:${normalizedCode}`
      : `import:${normalizedCode}`
    : `import:${section}:${name.toLowerCase()}`
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

function formatDeckCardLine(card: ImportedDeckCard, includeMetadata: boolean, game?: TournamentTCG) {
  if (!includeMetadata) {
    const code = game === 'one-piece' ? extractOnePieceCardCode(card.cardId) ?? extractOnePieceCardCode(card.name) : undefined
    if (code) return `${code} ${card.name}`
    return card.name
  }
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
