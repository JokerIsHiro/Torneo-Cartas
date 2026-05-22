// Códigos oficiales OPTCG: OP15-058, ST10-010, EB01-012, OP12-001_p1, etc.
export const ONE_PIECE_CARD_CODE_PATTERN = /\b([A-Z]{2,4}\d{2}-\d{3}(?:_p\d+)?[a-z]?)\b/i

export const ONE_PIECE_CARD_CODE_STRICT = /^[A-Z]{2,4}\d{2}-\d{3}(?:_p\d+)?[a-z]?$/i

export function extractOnePieceCardCode(value: string) {
  return value.match(ONE_PIECE_CARD_CODE_PATTERN)?.[1].toUpperCase()
}

export function isOnePieceCardCode(value: string) {
  return ONE_PIECE_CARD_CODE_STRICT.test(value.trim())
}

export function extractOnePieceCardCodeFromCardId(cardId: string) {
  const suffix = cardId.includes(':') ? cardId.split(':').pop() ?? cardId : cardId
  const code = suffix?.trim() ?? ''
  return isOnePieceCardCode(code) ? code.toUpperCase() : extractOnePieceCardCode(suffix ?? '')
}
