import type { TournamentTCG } from '../types/tournament'
import { extractOnePieceCardCode, ONE_PIECE_CARD_CODE_PATTERN } from './onePieceCardCode'

export type ParsedDeckLine = {
  quantity: number
  name: string
  cardCode?: string
  sectionHint?: string
}

const MULTIPLY_CHARS = '[x×✕✖*]'

/** Patrón interno (sin \\b) para combinar en otras expresiones. */
const OP_CODE_INNER = '[A-Z]{1,4}\\d{0,2}-\\d{3}(?:_p\\d+)?[a-z]?'

/** Normaliza pegados desde simuladores, web y hojas de calculo. */
export function normalizePasteText(text: string) {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00d7/gi, 'x')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function shouldIgnoreDeckLine(line: string) {
  const lower = line.toLowerCase().trim()
  if (!lower) return true
  if (/^[-_=~*#]{3,}$/.test(line)) return true
  if (/^\*+$/.test(line)) return true
  if (/^\/\//.test(line)) return true
  if (/^#(created|main|extra|side)\b/.test(lower)) return true
  if (lower.startsWith('#')) return true

  const ignorePrefixes = [
    'total cards',
    'total:',
    'total ',
    'decklist',
    'deck list',
    'deck name',
    'deckname',
    'nombre del mazo',
    'format:',
    'formato:',
    'author:',
    'autor:',
    'maybeboard',
    'considering',
    'tokens',
    'maybe:',
    'deck list generated',
    'generated on',
    'pokémon trading card game',
    'pokemon trading card game',
    '******',
    'buy on',
    'tcgplayer',
    'export ',
    'import ',
    'clear',
    'unselect',
    'select all',
  ]

  if (ignorePrefixes.some(prefix => lower.startsWith(prefix) || lower.includes(prefix))) return true
  if (lower === 'don!!' || lower === 'don !!!' || lower === 'don') return true
  if (/^\d+\s*cards?\s*$/i.test(line)) return true
  if (/^(qty|quantity|cantidad|count|copies|copias)\s*$/i.test(lower)) return true
  if (/^(name|nombre|carta|card|id|código|codigo)\s*$/i.test(lower)) return true

  return false
}

export function parseDeckLine(game: TournamentTCG, rawLine: string): ParsedDeckLine | null {
  let line = rawLine.trim()
  if (!line || shouldIgnoreDeckLine(line)) return null

  line = line
    .replace(/^\d+[.):]\s+/, "")
    .replace(/^(?:[-•▪►]\s*)+/, "")
    .replace(/^\[(?:qty|quantity|cantidad)\]\s*/i, '')
    .replace(/^(?:qty|quantity|cantidad|count|copies|copias)\s*[:=]\s*/i, '')
    .trim()

  const attempts: Array<() => ParsedDeckLine | null> = [
    () => parseOptcgSimLine(line),
    () => parseMarkdownTableLine(line, game),
    () => parseTcgplayerLine(line),
    () => parseQuantityCodeLine(line, game),
    () => parseCodeFirstLine(line, game),
    () => parseNameQuantitySuffixLine(line, game),
    () => parseParentheticalCodeLine(line, game),
    () => parseBracketQuantityLine(line, game),
    () => parseLegacyPatterns(line, game),
    () => parseBareCodeOrNameLine(line, game),
  ]

  for (const attempt of attempts) {
    const parsed = attempt()
    if (parsed && parsed.quantity > 0 && parsed.name) return parsed
  }

  return null
}

function parseOptcgSimLine(line: string): ParsedDeckLine | null {
  const glued = line.match(new RegExp(`^(\\d+)${MULTIPLY_CHARS}?\\s*(${OP_CODE_INNER})\\s*(.*)$`, 'i'))
  if (glued) {
    const code = glued[2].toUpperCase()
    const rest = glued[3]?.trim() ?? ''
    return { quantity: Number(glued[1]), name: rest || code, cardCode: code }
  }

  const codeQty = line.match(new RegExp(`^(${OP_CODE_INNER})${MULTIPLY_CHARS}?\\s*(\\d+)\\s*(.*)$`, 'i'))
  if (codeQty) {
    const code = codeQty[1].toUpperCase()
    const rest = codeQty[3]?.trim() ?? ''
    return { quantity: Number(codeQty[2]), name: rest || code, cardCode: code }
  }

  const onlyCode = line.match(new RegExp(`^(${OP_CODE_INNER})$`, 'i'))
  if (onlyCode) {
    const code = onlyCode[1].toUpperCase()
    return { quantity: 1, name: code, cardCode: code }
  }

  return null
}

function parseMarkdownTableLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  if (!line.includes('|')) return null
  const cells = line.split('|').map(cell => cell.trim()).filter(Boolean)
  if (cells.length < 2) return null

  const header = cells.join(' ').toLowerCase()
  if (/^(qty|quantity|cantidad|#|count|copies|name|nombre|card|carta|id|código|codigo)/i.test(cells[0] ?? '')) {
    if (header.includes('name') || header.includes('nombre') || header.includes('qty')) return null
  }

  const qtyCell = cells.find(cell => /^\d+$/.test(cell))
  const quantity = qtyCell ? Number(qtyCell) : Number(cells[0])
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const codeCell = cells.find(cell => extractCardCode(game, cell))
  const cardCode = codeCell ? extractCardCode(game, codeCell) : undefined
  const nameCell = cells.find(cell => {
    if (cardCode && cell.toUpperCase().includes(cardCode)) return false
    if (/^\d+$/.test(cell)) return false
    return /[a-zA-Z]{2,}/.test(cell)
  })

  const name = cleanName(game, nameCell ?? cells[1] ?? cells[0], cardCode)
  if (!name) return null

  return { quantity, name, cardCode }
}

function parseTcgplayerLine(line: string): ParsedDeckLine | null {
  const bracket = line.match(/^(\d+)\s+(.+?)\s+\[([A-Z0-9-]+)\]\s*#?(\d+[a-z]?)?/i)
  if (bracket) {
    return {
      quantity: Number(bracket[1]),
      name: bracket[2].trim(),
      cardCode: bracket[4] ? `${bracket[3]}-${bracket[4]}` : bracket[3],
    }
  }

  const arena = line.match(/^(\d+)\s+(.+?)\s+\(([A-Z0-9]{2,6})\)\s*#?(\d+[a-z]?)?/i)
  if (arena) {
    return {
      quantity: Number(arena[1]),
      name: arena[2].trim(),
      cardCode: arena[4] ? `${arena[3]} ${arena[4]}` : arena[3],
    }
  }

  return null
}

function parseQuantityCodeLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const patterns = [
    new RegExp(`^(\\d+)${MULTIPLY_CHARS}\\s*(.+)$`, "i"),
    /^(\d+)\s*x\s*(.+)$/i,
    /^(\d+)\s*[:-]\s*(.+)$/i,
    /^(\d+)\s+(.+)$/i,
    /^(\d+)\s*[,;]\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (!match) continue
    const quantity = Number(match[1])
    const remainder = match[2].trim()
    const cardCode = extractCardCode(game, remainder)
    const name = cleanName(game, remainder, cardCode)
    if (name) return { quantity, name, cardCode }
  }

  return null
}

function parseCodeFirstLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const codeQtyName = line.match(new RegExp(`^(${OP_CODE_INNER})\\s+(\\d+)\\s+(.+)$`, 'i'))
  if (codeQtyName) {
    const code = codeQtyName[1].toUpperCase()
    return { quantity: Number(codeQtyName[2]), name: cleanName(game, codeQtyName[3], code), cardCode: code }
  }

  const codeDashName = line.match(new RegExp(`^(${OP_CODE_INNER})\\s*[-–—]\\s*(.+)$`, 'i'))
  if (codeDashName) {
    const code = codeDashName[1].toUpperCase()
    return { quantity: 1, name: cleanName(game, codeDashName[2], code), cardCode: code }
  }

  const qtyCode = line.match(new RegExp(`^(${OP_CODE_INNER})\\s+(.+?)\\s+(\\d+)$`, 'i'))
  if (qtyCode) {
    const code = qtyCode[1].toUpperCase()
    return { quantity: Number(qtyCode[3]), name: cleanName(game, qtyCode[2], code), cardCode: code }
  }

  return null
}

function parseNameQuantitySuffixLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const suffix = line.match(new RegExp(`^(.+?)${MULTIPLY_CHARS}\\s*(\\d+)$`, 'i'))
  if (suffix) {
    const cardCode = extractCardCode(game, suffix[1])
    return {
      quantity: Number(suffix[2]),
      name: cleanName(game, suffix[1], cardCode),
      cardCode,
    }
  }

  const nameQty = line.match(/^(.+?)\s+(\d+)\s*$/)
  if (nameQty && !extractCardCode(game, nameQty[1])) {
    const cardCode = extractCardCode(game, nameQty[1])
    return {
      quantity: Number(nameQty[2]),
      name: cleanName(game, nameQty[1], cardCode),
      cardCode,
    }
  }

  return null
}

function parseParentheticalCodeLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const parenQty = line.match(/^\((\d+)\)\s*(.+)$/i)
  if (parenQty) {
    const cardCode = extractCardCode(game, parenQty[2])
    return {
      quantity: Number(parenQty[1]),
      name: cleanName(game, parenQty[2], cardCode),
      cardCode,
    }
  }

  const nameCode = line.match(/^(.+?)\s*\(([^)]+)\)\s*(?:\(([A-Z]{2,4})\))?$/i)
  if (nameCode) {
    const inner = nameCode[2].trim()
    const codeFromInner = extractCardCode(game, inner)
    const cardCode = codeFromInner ?? (/^\d{3}$/.test(inner) ? undefined : extractCardCode(game, line))
    const qtyMatch = inner.match(/^(\d+)\s*(.*)$/)
    if (qtyMatch && !codeFromInner) {
      return {
        quantity: Number(qtyMatch[1]),
        name: cleanName(game, nameCode[1], cardCode),
        cardCode,
      }
    }
    if (codeFromInner) {
      return { quantity: 1, name: cleanName(game, nameCode[1], codeFromInner), cardCode: codeFromInner }
    }
  }

  return null
}

function parseBracketQuantityLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const bracket = line.match(/^\[(\d+)\]\s*(.+)$/i)
  if (!bracket) return null
  const cardCode = extractCardCode(game, bracket[2])
  return {
    quantity: Number(bracket[1]),
    name: cleanName(game, bracket[2], cardCode),
    cardCode,
  }
}

function parseLegacyPatterns(line: string, game: TournamentTCG): ParsedDeckLine | null {
  const quantityLast = line.match(/^(.+?)\s+x\s*(\d+)$/i)
  if (quantityLast) {
    const cardCode = extractCardCode(game, quantityLast[1])
    return {
      quantity: Number(quantityLast[2]),
      name: cleanName(game, quantityLast[1], cardCode),
      cardCode,
    }
  }
  return null
}

function parseBareCodeOrNameLine(line: string, game: TournamentTCG): ParsedDeckLine | null {
  if (game === 'one-piece') {
    const code = extractOnePieceCardCode(line)
    if (code) {
      const name = cleanName(game, line, code)
      return { quantity: 1, name, cardCode: code }
    }
  }

  if (/^\d+\s+[A-Za-z]/.test(line)) return null

  if (line.length >= 2 && /[a-zA-Z]/.test(line)) {
    return { quantity: 1, name: cleanName(game, line), cardCode: extractCardCode(game, line) }
  }

  return null
}

function extractCardCode(game: TournamentTCG, value: string) {
  if (game === 'one-piece') return extractOnePieceCardCode(value)
  if (game === 'riftbound') return value.match(/\b([A-Z]{2,4}-\d{1,3}[A-Z]?(?:-\d+)?)\b/i)?.[1]?.toLowerCase()
  if (game === 'pokemon') {
    const setCollector = value.match(/\b([A-Z0-9]{2,8})\s+(0*\d{1,4}[a-z]?)(?:\/\d+)?(?:\s+(?:PH|RH|H|NH|F|REVERSE|HOLO|PROMO|STAFF))?\b/i)
    if (setCollector) return `${setCollector[1].toUpperCase()}-${setCollector[2].toLowerCase()}`
  }
  if (game === 'lorcana') {
    return value.match(/\b((?:D100|[A-Z]{1,5}|\d{1,2})[\s_/#-]+0*\d{1,3}[a-z]?)\b/i)?.[1]?.toUpperCase()
  }
  if (game === 'magic') {
    const setCollector = value.match(/\b([A-Z0-9]{2,8})[\s_/#-]+([0-9]{1,4}[A-Z]?|[A-Z0-9]{1,8}[★☆])\b/i)
    if (setCollector) return `${setCollector[1].toUpperCase()}-${setCollector[2].toLowerCase()}`
  }

  const fb = value.match(/\b(FB\d{2}-\d{3}|FS\d{2}-\d{2,3})\b/i)?.[1]?.toUpperCase()
  if (fb) return fb

  const sor = value.match(/\b([A-Z]{2,4}-\d{3})\b/)?.[1]?.toUpperCase()
  if (sor) return sor

  const op = extractOnePieceCardCode(value)
  if (op) return op

  return undefined
}

function cleanName(game: TournamentTCG, raw: string, cardCode?: string) {
  let name = raw.trim()
  if (!name) return cardCode ?? ''

  if (cardCode) {
    name = name.replace(new RegExp(cardCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    name = name.replace(ONE_PIECE_CARD_CODE_PATTERN, '')
  }

  name = name
    .replace(/\s*\([^)]*(?:alternate|alt|manga|parallel|reprint|full art|sp|aa|aa)[^)]*\)/gi, '')
    .replace(/\s*\[(?!(?:id|img|art|orient|sub|kind)=)[^\]]+\]\s*$/gi, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (game === 'magic' || game === 'lorcana') {
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)\s+\d+[a-z]?$/i, '')
    name = name.replace(/\s+\([A-Z0-9]{2,6}\)$/i, '')
    name = name.replace(/\s+[A-Z0-9]{2,8}\s+\d{1,4}[a-z]?\s*$/i, '')
    name = name.replace(/\s+[A-Z0-9]{2,8}[-/#]\d{1,4}[a-z]?\s*$/i, '')
    name = name.replace(/\s+\*F\*$/i, '')
  }

  if (game === 'pokemon') {
    name = name.replace(/\s+[A-Z0-9]{2,8}\s+\d+[a-z]?(?:\/\d+)?(?:\s+(?:PH|RH|H|NH|F|REVERSE|HOLO|PROMO|STAFF))?$/i, '')
    name = name.replace(/\s+\d+\/\d+\s*$/i, '')
    name = name.replace(/\s+[A-Z]\d+\s+\d+$/i, '')
    name = name.replace(/\s+(?:PH|RH|H|NH|F|REVERSE|HOLO|PROMO|STAFF)$/i, '')
  }

  if (game === 'riftbound') {
    name = name.replace(/\s+\[[A-Z0-9-]+\]\s*$/i, '')
    name = name.replace(/\s+\([A-Z0-9-]+\)\s*$/i, '')
  }

  name = name.replace(/\s*\(TR\)\s*$/i, '').trim()

  if (!name && cardCode) return cardCode
  return name
}

export function tryParseJsonDecklist(text: string, game: TournamentTCG): ParsedDeckLine[] | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    const data = JSON.parse(trimmed) as unknown
    const lines: ParsedDeckLine[] = []
    collectJsonCards(data, game, lines, 'Main')
    return lines.length ? lines : null
  } catch {
    return null
  }
}

export function tryParseMagicDekBlock(text: string): ParsedDeckLine[] | null {
  const trimmed = text.trim()
  if (!/^<\?xml|<Deck\b/i.test(trimmed) || !/<Cards\b/i.test(trimmed)) return null

  const lines: ParsedDeckLine[] = []
  const cardTagPattern = /<Cards\b[^>]*\/?>/gi
  const attrPattern = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g

  for (const tagMatch of trimmed.matchAll(cardTagPattern)) {
    const attributes = new Map<string, string>()
    const tag = tagMatch[0]

    for (const attrMatch of tag.matchAll(attrPattern)) {
      attributes.set(attrMatch[1].toLowerCase(), decodeXmlEntities(attrMatch[2]))
    }

    const name = attributes.get('name')?.trim()
    const quantity = Number(attributes.get('quantity') ?? 1)
    const catId = attributes.get('catid')?.trim()
    const isSideboard = attributes.get('sideboard')?.toLowerCase() === 'true'

    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue

    lines.push({
      quantity,
      name,
      cardCode: catId ? `mtgo-${catId}` : undefined,
      sectionHint: isSideboard ? 'Sideboard' : 'Main',
    })
  }

  return lines.length ? lines : null
}

function collectJsonCards(
  data: unknown,
  game: TournamentTCG,
  lines: ParsedDeckLine[],
  defaultSection: string,
  depth = 0,
) {
  if (depth > 8 || data == null) return

  if (Array.isArray(data)) {
    for (const item of data) collectJsonCards(item, game, lines, defaultSection, depth + 1)
    return
  }

  if (typeof data !== 'object') return

  const record = data as Record<string, unknown>
  const sideSection = game === 'yugioh' ? 'Side' : 'Sideboard'
  const sectionMap: Record<string, string> = {
    leader: 'Leader',
    leaders: 'Leader',
    main: 'Main',
    deck: 'Main',
    mainboard: 'Main',
    maindeck: 'Main',
    mainDeck: 'Main',
    'main-deck': 'Main',
    extra: 'Extra',
    extraDeck: 'Extra',
    side: sideSection,
    sideboard: sideSection,
    sideDeck: sideSection,
    'side-deck': sideSection,
    pokemon: 'Pokemon',
    trainer: 'Trainers',
    trainers: 'Trainers',
    energy: 'Energy',
    legend: 'Legend',
    champion: 'Champion',
    runes: 'Rune',
    rune: 'Rune',
    runepool: 'Rune',
    'rune-pool': 'Rune',
    runedeck: 'Rune',
    'rune-deck': 'Rune',
    battlefield: 'Battlefield',
    battlefields: 'Battlefield',
  }

  for (const [key, value] of Object.entries(record)) {
    const section = sectionMap[key.toLowerCase()] ?? defaultSection
    if (Array.isArray(value)) {
      for (const entry of value) pushJsonEntry(entry, game, lines, section)
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('count' in value || 'qty' in value || 'quantity' in value || 'id' in value || 'name' in value) {
        pushJsonEntry(value, game, lines, section)
      } else {
        collectJsonCards(value, game, lines, section, depth + 1)
      }
    }
  }
}

function pushJsonEntry(entry: unknown, game: TournamentTCG, lines: ParsedDeckLine[], section: string) {
  if (!entry || typeof entry !== 'object') return
  const row = entry as Record<string, unknown>
  const quantity = Number(row.count ?? row.qty ?? row.quantity ?? 1)
  const id = String(row.id ?? row.card_id ?? row.cardId ?? row.code ?? '').trim()
  const name = String(row.name ?? row.card_name ?? row.title ?? '').trim()
  const cardCode = extractCardCode(game, id) ?? extractCardCode(game, name)
  const resolvedName = cleanName(game, name || id, cardCode) || cardCode || id

  if (!resolvedName || quantity <= 0) return

  lines.push({
    quantity,
    name: resolvedName,
    cardCode,
    sectionHint: section,
  })
}

export function tryParsePokemonComBlock(text: string): ParsedDeckLine[] | null {
  if (!/pokémon|pokemon/i.test(text) || !/trading card game deck list/i.test(text)) return null

  const lines: ParsedDeckLine[] = []
  let section = 'Pokemon'

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('***')) continue

    const sectionMatch = line.match(/^(Pokémon|Pokemon|Trainer Cards?|Trainers|Energy Cards?|Energy)\s*(?:[-–—:]\s*\d+|\(\s*\d+\s*(?:cards?)?\s*\)\s*:?)\s*$/i)
    if (sectionMatch) {
      const label = sectionMatch[1].toLowerCase()
      if (label.includes('trainer')) section = 'Trainers'
      else if (label.includes('energy')) section = 'Energy'
      else section = 'Pokemon'
      continue
    }

    const parsed = parseDeckLine('pokemon' as TournamentTCG, line)
    if (parsed) {
      lines.push({
        ...parsed,
        sectionHint: section,
      })
    }
  }

  return lines.length ? lines : null
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
