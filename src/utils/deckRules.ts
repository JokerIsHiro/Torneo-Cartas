import type { CardSuggestion } from '../services/cardSearch'
import type { TournamentTCG } from '../types/tournament'

export interface DeckRuleSection {
  id: string
  label: string
  min?: number
  max?: number
}

export interface DeckRuleConfig {
  label: string
  sections: DeckRuleSection[]
  copyLimit?: number
  exactDeckSize?: number
  mainMin?: number
  mainMax?: number
}

export interface RuleDeckCard {
  name: string
  kind?: string
  section: string
  quantity: number
}

export const deckRuleConfigs: Record<TournamentTCG, DeckRuleConfig> = {
  magic: {
    label: 'Magic',
    sections: [
      { id: 'Main', label: 'Main Deck', min: 60 },
      { id: 'Sideboard', label: 'Sideboard', max: 15 },
    ],
    copyLimit: 4,
  },
  riftbound: {
    label: 'Riftbound',
    sections: [
      { id: 'Main', label: 'Main Deck' },
      { id: 'Rune', label: 'Mazo de runas' },
      { id: 'Sideboard', label: 'Sideboard' },
    ],
  },
  pokemon: {
    label: 'Pokemon',
    sections: [
      { id: 'Pokemon', label: 'Pokemon' },
      { id: 'Trainers', label: 'Trainers' },
      { id: 'Energy', label: 'Energy' },
    ],
    exactDeckSize: 60,
    copyLimit: 4,
  },
  yugioh: {
    label: 'YuGiOh',
    sections: [
      { id: 'Main', label: 'Main Deck', min: 40, max: 60 },
      { id: 'Extra', label: 'Extra Deck', max: 15 },
      { id: 'Side', label: 'Side Deck', max: 15 },
    ],
    copyLimit: 3,
  },
  lorcana: {
    label: 'Lorcana',
    sections: [
      { id: 'Main', label: 'Main Deck', min: 60 },
    ],
    copyLimit: 4,
  },
  'one-piece': {
    label: 'One Piece',
    sections: [
      { id: 'Main', label: 'Main Deck', min: 50, max: 50 },
      { id: 'DON!!', label: 'DON!! Deck', min: 10, max: 10 },
    ],
    copyLimit: 4,
  },
}

const yugiohExtraTypes = ['fusion', 'synchro', 'xyz', 'link']
const unlimitedMagicNames = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes']

export function getDefaultSection(game: TournamentTCG, card?: Pick<CardSuggestion, 'name' | 'kind' | 'subtitle'>) {
  if (!card) return deckRuleConfigs[game].sections[0].id

  const text = `${card.name} ${card.kind ?? ''} ${card.subtitle ?? ''}`.toLowerCase()

  if (game === 'yugioh' && yugiohExtraTypes.some(type => text.includes(type))) return 'Extra'
  if (game === 'pokemon') {
    if (text.includes('energy')) return 'Energy'
    if (text.includes('trainer') || text.includes('item') || text.includes('supporter') || text.includes('stadium')) return 'Trainers'
    return 'Pokemon'
  }
  if (game === 'riftbound' && text.includes('rune')) return 'Rune'
  if (game === 'one-piece' && text.includes('don')) return 'DON!!'

  return deckRuleConfigs[game].sections[0].id
}

export function validateDeck(game: TournamentTCG, cards: RuleDeckCard[]) {
  const config = deckRuleConfigs[game]
  const warnings: string[] = []
  const totals = new Map<string, number>()

  for (const section of config.sections) {
    totals.set(section.id, cards.filter(card => card.section === section.id).reduce((sum, card) => sum + card.quantity, 0))
  }

  for (const section of config.sections) {
    const total = totals.get(section.id) ?? 0
    if (section.min !== undefined && total < section.min) warnings.push(`${section.label}: minimo ${section.min} cartas`)
    if (section.max !== undefined && total > section.max) warnings.push(`${section.label}: maximo ${section.max} cartas`)
  }

  const deckTotal = [...totals.values()].reduce((sum, total) => sum + total, 0)
  if (config.exactDeckSize !== undefined && deckTotal !== config.exactDeckSize) {
    warnings.push(`Deck: exactamente ${config.exactDeckSize} cartas`)
  }

  if (config.copyLimit) {
    const byName = new Map<string, number>()
    cards.forEach(card => byName.set(card.name.toLowerCase(), (byName.get(card.name.toLowerCase()) ?? 0) + card.quantity))
    byName.forEach((quantity, name) => {
      if (isUnlimited(game, name)) return
      if (quantity > config.copyLimit!) warnings.push(`${titleCase(name)}: maximo ${config.copyLimit} copias`)
    })
  }

  return warnings
}

function isUnlimited(game: TournamentTCG, name: string) {
  if (game === 'magic') return unlimitedMagicNames.includes(name)
  if (game === 'pokemon') return name.includes('basic') && name.includes('energy')
  if (game === 'one-piece') return name.includes('don')
  return false
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, letter => letter.toUpperCase())
}
