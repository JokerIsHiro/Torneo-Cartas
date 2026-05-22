import type { TournamentTCG } from '../types/tournament'
import { deckRuleConfigs } from './deckRules'
import { extractOnePieceCardCode, ONE_PIECE_CARD_CODE_PATTERN } from './onePieceCardCode'

// Importador tolerante por juego. La idea es aceptar el texto que el usuario
// copia desde herramientas externas, no obligarle a aprender un formato propio.
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
    mainboard: 'Main',
    cards: 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    side: 'Sideboard',
    sideboard: 'Sideboard',
    banquillo: 'Sideboard',
    reserva: 'Sideboard',
    commander: 'Main',
    companion: 'Sideboard',
    creatures: 'Main',
    creature: 'Main',
    spells: 'Main',
    spell: 'Main',
    lands: 'Main',
    land: 'Main',
  },
  yugioh: {
    main: 'Main',
    'main deck': 'Main',
    monster: 'Main',
    monsters: 'Main',
    monstruo: 'Main',
    monstruos: 'Main',
    spell: 'Main',
    'spell cards': 'Main',
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
    'extra deck cards': 'Extra',
    side: 'Side',
    'side deck': 'Side',
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
    main: 'Main',
    deck: 'Main',
    'main deck': 'Main',
    mainboard: 'Main',
    mazo: 'Main',
    'mazo principal': 'Main',
    character: 'Main',
    characters: 'Main',
    event: 'Main',
    events: 'Main',
    stage: 'Main',
    stages: 'Main',
    'don deck': 'Main',
    'don!! deck': 'Main',
    don: 'Main',
    'don!!': 'Main',
  },
  chess: {},
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
      ...createImportedCard(game, parsed.name, parsed.quantity, forcedSection, parsed.cardCode),
      ...parsed.metadata,
    })
  }

  return { cards: mergeImportedCards(cards), ignoredLines }
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

function parseYdk(list: string): DeckImportResult {
  // Los .ydk no guardan nombres, solo passcodes. El constructor los hidrata
  // despues contra YGOPRODeck para mostrar nombre e imagen cuando sea posible.
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
    .replace(/^\s*[-•]\s+/, '')
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
    lower.startsWith('decklist') ||
    lower.startsWith('deck list') ||
    lower.startsWith('maybeboard') ||
    lower.startsWith('considering') ||
    lower.startsWith('tokens') ||
    lower === 'don!!' ||
    lower.includes('deck list generated')
  )
}

function getSectionFromLine(game: TournamentTCG, line: string) {
  const clean = line
    .replace(/\s*\(\s*\d+\s*(?:cards?|cartas?)?\s*\)\s*$/gi, '')
    .replace(/\s*\[\s*\d+\s*(?:cards?|cartas?)?\s*\]\s*$/gi, '')
    .replace(/\s*[-:]\s*\d+\s*$/g, '')
    .replace(/\s*[-:]\s*\d+\s*(?:cards?|cartas?)\s*$/gi, '')
    .replace(/\s+\d+\s*(?:cards?|cartas?)\s*$/gi, '')
    .replace(/:$/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return sectionAliases[game][clean]
}

function parseCardLine(game: TournamentTCG, line: string): ParsedLine | null {
  const quantityFirst = line.match(/^(\d+)\s*x?\s+(.+)$/i)
  const quantityColon = line.match(/^(\d+)\s*[:-]\s*(.+)$/i)
  const quantityWithX = line.match(/^(\d+)\s*x\s*(.+)$/i)
  const quantityLast = line.match(/^(.+?)\s+x\s*(\d+)$/i)
  const codeQuantityLast = line.match(/^([A-Z]{2,4}\d{2}-\d{3}[a-z]?)\s+(.+?)\s+(\d+)$/i)
  const codeQuantityAfterCode = line.match(/^([A-Z]{2,4}\d{2}-\d{3}[a-z]?)\s+(\d+)\s+(.+)$/i)
  const csvLine = line.match(/^(\d+)\s*[,;]\s*(.+?)(?:\s*[,;].*)?$/i)

  const quantity = Number(
    codeQuantityAfterCode?.[2] ??
    codeQuantityLast?.[3] ??
    csvLine?.[1] ??
    quantityWithX?.[1] ??
    quantityColon?.[1] ??
    quantityFirst?.[1] ??
    quantityLast?.[2] ??
    1
  )
  const rawName =
    (codeQuantityAfterCode ? `${codeQuantityAfterCode[1]} ${codeQuantityAfterCode[3]}` : undefined) ??
    (codeQuantityLast ? `${codeQuantityLast[1]} ${codeQuantityLast[2]}` : undefined) ??
    csvLine?.[2] ??
    quantityWithX?.[2] ??
    quantityColon?.[2] ??
    quantityFirst?.[2] ??
    quantityLast?.[1] ??
    line
  const cleaned = cleanCardName(game, rawName)
  if (!cleaned.name) return null
  return { quantity, ...cleaned }
}

function cleanCardName(game: TournamentTCG, rawName: string): { name: string; cardCode?: string; metadata?: ParsedLine['metadata'] } {
  let name = rawName.trim()
  let cardCode: string | undefined

  const metadataMatch = name.match(/^(.*?)\s+\[(.+?)\]$/)
  if (metadataMatch) {
    // Formato interno guardado por la app: conserva imagen, tipo y subtitulo
    // para no depender de la API cada vez que se reabre una lista.
    const metadata = parseCardMetadata(metadataMatch[2])
    return {
      name: metadataMatch[1].trim(),
      cardCode: metadata.cardId,
      metadata,
    }
  }

  if (game === 'magic' || game === 'lorcana') {
    // Arena/Dreamborn suelen anadir set y numero. Para buscar por nombre
    // conviene quitar esa cola, pero mantener el nombre de la carta intacto.
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)\s+\d+[a-z]?$/i, '')
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)$/i, '')
    name = name.replace(/\s+\*F\*$/i, '')
  }

  if (game === 'pokemon') {
    // Pokemon exporta muchas listas como "Nombre SET 123".
    name = name.replace(/\s+[A-Z]{2,5}\s+\d+[a-z]?$/i, '')
    name = name.replace(/\s+\d+\/\d+\s*$/i, '')
  }

  if (game === 'one-piece') {
    // Formato habitual: "4 OP12-071 Charlotte Pudding" o "OP15-058 Enel".
    const codeMatch = name.match(ONE_PIECE_CARD_CODE_PATTERN)
    if (codeMatch) {
      cardCode = codeMatch[1].toUpperCase()
      name = name.replace(codeMatch[0], '').replace(/^[-:]\s*/, '').trim()
      if (!name) name = cardCode
    }
  }

  if (game === 'riftbound') {
    name = name.replace(/\s+\[[A-Z0-9-]+\]\s*$/i, '')
    name = name.replace(/\s+\([A-Z0-9-]+\)\s*$/i, '')
  }

  return { name: name.trim(), cardCode }
}

function getForcedSection(game: TournamentTCG, currentSection: string) {
  if (game === 'one-piece' && currentSection !== 'Leader') return 'Main'
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
