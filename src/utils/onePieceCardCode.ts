// Códigos oficiales OPTCG: OP15-058, ST10-010, EB01-012, PRB01-001, etc.
export const ONE_PIECE_CARD_CODE_PATTERN = /\b([A-Z]{1,4}\d{0,2}-\d{3}[a-z]?)\b/i

export function extractOnePieceCardCode(value: string) {
  return value.match(ONE_PIECE_CARD_CODE_PATTERN)?.[1].toUpperCase()
}

export function isOnePieceCardCode(value: string) {
  return /^[A-Z]{1,4}\d{0,2}-\d{3}[a-z]?$/i.test(value.trim())
}

export function extractOnePieceCardCodeFromCardId(cardId: string) {
  const suffix = cardId.includes(':') ? cardId.split(':').pop() ?? cardId : cardId
  return isOnePieceCardCode(suffix) ? suffix.toUpperCase() : undefined
}
