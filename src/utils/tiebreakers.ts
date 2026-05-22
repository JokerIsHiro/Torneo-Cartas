import type { Match, Player, Round, TournamentTCG, TournamentTiebreakerSystem } from '../types/tournament'

export type TiebreakerMetricKey =
  | 'matchWinPercentage'
  | 'opponentMatchWinPercentage'
  | 'opponentsOpponentMatchWinPercentage'
  | 'opponentWinPercentage'
  | 'opponentsOpponentWinPercentage'
  | 'buchholz'
  | 'buchholzCut1'
  | 'buchholzMedian1'
  | 'sonnebornBerger'
  | 'progressiveScore'
  | 'wins'
  | 'losses'
  | 'timeoutLosses'
  | 'directEncounter'

export type TiebreakerMetrics = Record<Exclude<TiebreakerMetricKey, 'directEncounter'>, number>

export interface TiebreakerSystemOption {
  value: TournamentTiebreakerSystem
  label: string
  shortLabel: string
  description: string
}

export const tiebreakerSystemOptions: TiebreakerSystemOption[] = [
  {
    value: 'tcg-resistance',
    label: 'TCG - Resistencia',
    shortLabel: 'Resistencia',
    description: 'Puntos de rivales, porcentaje de rivales y rivales de rivales.',
  },
  {
    value: 'magic-match',
    label: 'Magic - Match Win %',
    shortLabel: 'OMW%',
    description: 'OMW%, Match Win % y rivales de rivales. No usa Game Win % porque no se guardan parciales 2-1.',
  },
  {
    value: 'pokemon-official',
    label: 'Pokemon - Op Win %',
    shortLabel: 'Op Win %',
    description: 'Porcentaje de victorias de rivales, rivales de rivales y frente a frente.',
  },
  {
    value: 'fide-buchholz',
    label: 'Ajedrez - Buchholz',
    shortLabel: 'Buchholz',
    description: 'Suma de puntos de los rivales, con Sonneborn-Berger y progresivo como apoyo.',
  },
  {
    value: 'fide-buchholz-cut-1',
    label: 'Ajedrez - Buchholz Cut 1',
    shortLabel: 'Buchholz C1',
    description: 'Buchholz quitando el rival con menor puntuacion.',
  },
  {
    value: 'fide-buchholz-median-1',
    label: 'Ajedrez - Buchholz Mediano',
    shortLabel: 'Mediano',
    description: 'Buchholz quitando el rival con menor y mayor puntuacion.',
  },
  {
    value: 'fide-sonneborn-berger',
    label: 'Sonneborn-Berger',
    shortLabel: 'SB',
    description: 'Suma ponderada de los puntos de cada rival segun el resultado contra el.',
  },
  {
    value: 'fide-progressive',
    label: 'Progresivo acumulado',
    shortLabel: 'Progresivo',
    description: 'Suma de la puntuacion acumulada al final de cada ronda.',
  },
  {
    value: 'direct-encounter',
    label: 'Frente a frente',
    shortLabel: 'H2H',
    description: 'Prioriza el resultado directo entre dos jugadores empatados.',
  },
  {
    value: 'wins',
    label: 'Mas victorias',
    shortLabel: 'Victorias',
    description: 'Ordena por numero de victorias despues de los puntos.',
  },
  {
    value: 'fewest-losses',
    label: 'Menos derrotas',
    shortLabel: 'Derrotas',
    description: 'Ordena por menos derrotas despues de los puntos.',
  },
  {
    value: 'fewest-timeout-losses',
    label: 'Menos derrotas por tiempo',
    shortLabel: 'Tiempo',
    description: 'Ordena por menos derrotas automaticas por tiempo.',
  },
  {
    value: 'none',
    label: 'Sin desempate',
    shortLabel: 'Nombre',
    description: 'Solo puntos y orden alfabetico estable.',
  },
]

const systemSteps: Record<TournamentTiebreakerSystem, TiebreakerMetricKey[]> = {
  'tcg-resistance': ['buchholz', 'opponentMatchWinPercentage', 'opponentsOpponentMatchWinPercentage', 'wins', 'timeoutLosses'],
  'magic-match': ['opponentMatchWinPercentage', 'matchWinPercentage', 'opponentsOpponentMatchWinPercentage', 'wins', 'timeoutLosses'],
  'pokemon-official': ['opponentWinPercentage', 'opponentsOpponentWinPercentage', 'directEncounter', 'wins'],
  'fide-buchholz': ['buchholz', 'sonnebornBerger', 'progressiveScore', 'wins'],
  'fide-buchholz-cut-1': ['buchholzCut1', 'buchholz', 'sonnebornBerger', 'wins'],
  'fide-buchholz-median-1': ['buchholzMedian1', 'buchholz', 'sonnebornBerger', 'wins'],
  'fide-sonneborn-berger': ['sonnebornBerger', 'buchholz', 'progressiveScore', 'wins'],
  'fide-progressive': ['progressiveScore', 'buchholz', 'sonnebornBerger', 'wins'],
  'direct-encounter': ['directEncounter', 'buchholz', 'wins'],
  wins: ['wins', 'buchholz', 'opponentMatchWinPercentage'],
  'fewest-losses': ['losses', 'buchholz', 'wins'],
  'fewest-timeout-losses': ['timeoutLosses', 'buchholz', 'wins'],
  none: [],
}

export function getDefaultTiebreakerSystem(tcg: TournamentTCG): TournamentTiebreakerSystem {
  if (tcg === 'pokemon') return 'pokemon-official'
  if (tcg === 'magic') return 'magic-match'
  if (tcg === 'chess') return 'fide-buchholz'
  return 'tcg-resistance'
}

export function getTiebreakerSystemOption(system: TournamentTiebreakerSystem) {
  return tiebreakerSystemOptions.find(option => option.value === system) ?? tiebreakerSystemOptions[0]
}

export function getTiebreakerSteps(system: TournamentTiebreakerSystem) {
  return systemSteps[system] ?? systemSteps['tcg-resistance']
}

export function getPrimaryTiebreakerMetric(system: TournamentTiebreakerSystem): TiebreakerMetricKey | null {
  return getTiebreakerSteps(system).find(step => step !== 'directEncounter') ?? null
}

export function getTiebreakerMetricLabel(metric: TiebreakerMetricKey) {
  const labels: Record<TiebreakerMetricKey, string> = {
    matchWinPercentage: 'MW%',
    opponentMatchWinPercentage: 'OMW%',
    opponentsOpponentMatchWinPercentage: 'OOW%',
    opponentWinPercentage: 'Op Win %',
    opponentsOpponentWinPercentage: 'Op Op %',
    buchholz: 'BH',
    buchholzCut1: 'BH-C1',
    buchholzMedian1: 'BH-M1',
    sonnebornBerger: 'SB',
    progressiveScore: 'Prog',
    wins: 'V',
    losses: 'D',
    timeoutLosses: 'Tiempo',
    directEncounter: 'H2H',
  }
  return labels[metric]
}

export function calculateTiebreakerMetrics(player: Player, players: Player[], rounds: Round[]): TiebreakerMetrics {
  const opponentIds = getCompletedOpponentIds(player.id, rounds)
  const opponents = opponentIds
    .map(opponentId => players.find(candidate => candidate.id === opponentId))
    .filter(Boolean) as Player[]

  const opponentScores = opponents.map(opponent => opponent.points)
  const opponentWinPercentages = opponents.map(opponent => getPokemonWinPercentage(opponent))
  const opponentMatchWinPercentages = opponents.map(opponent => getMatchWinPercentage(opponent))

  return {
    matchWinPercentage: getMatchWinPercentage(player),
    opponentMatchWinPercentage: average(opponentMatchWinPercentages),
    opponentsOpponentMatchWinPercentage: average(opponents.map(opponent => {
      const opponentOpponentIds = getCompletedOpponentIds(opponent.id, rounds)
      const opponentOpponents = opponentOpponentIds
        .map(opponentOpponentId => players.find(candidate => candidate.id === opponentOpponentId))
        .filter(Boolean) as Player[]
      return average(opponentOpponents.map(candidate => getMatchWinPercentage(candidate)))
    })),
    opponentWinPercentage: average(opponentWinPercentages),
    opponentsOpponentWinPercentage: average(opponents.map(opponent => {
      const opponentOpponentIds = getCompletedOpponentIds(opponent.id, rounds)
      const opponentOpponents = opponentOpponentIds
        .map(opponentOpponentId => players.find(candidate => candidate.id === opponentOpponentId))
        .filter(Boolean) as Player[]
      return average(opponentOpponents.map(candidate => getPokemonWinPercentage(candidate)))
    })),
    buchholz: sum(opponentScores),
    buchholzCut1: cutLow(opponentScores),
    buchholzMedian1: cutLowHigh(opponentScores),
    sonnebornBerger: getSonnebornBerger(player.id, players, rounds),
    progressiveScore: getProgressiveScore(player.id, rounds),
    wins: player.wins,
    losses: player.losses,
    timeoutLosses: player.timeoutLosses,
  }
}

export function compareByTiebreakers(
  a: { player: Player; tiebreakers: TiebreakerMetrics },
  b: { player: Player; tiebreakers: TiebreakerMetrics },
  rounds: Round[],
  system: TournamentTiebreakerSystem
) {
  for (const step of getTiebreakerSteps(system)) {
    if (step === 'directEncounter') {
      const direct = getHeadToHeadScore(a.player.id, b.player.id, rounds) - getHeadToHeadScore(b.player.id, a.player.id, rounds)
      if (direct !== 0) return -direct
      continue
    }

    const direction = step === 'losses' || step === 'timeoutLosses' ? 1 : -1
    const diff = a.tiebreakers[step] - b.tiebreakers[step]
    if (diff !== 0) return diff * direction
  }

  return a.player.name.localeCompare(b.player.name)
}

export function formatTiebreakerValue(metric: TiebreakerMetricKey | null, value: number | undefined) {
  if (!metric || value === undefined) return '-'
  if (metric.includes('Percentage')) return `${Math.round(value * 1000) / 10}%`
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2)
}

export function getTiebreakerValue(metrics: TiebreakerMetrics, metric: TiebreakerMetricKey | null) {
  if (!metric || metric === 'directEncounter') return undefined
  return metrics[metric]
}

function getMatchWinPercentage(player: Player) {
  const roundsPlayed = player.wins + player.losses + player.draws
  if (roundsPlayed <= 0) return 0
  return Math.max(0.33, player.points / (roundsPlayed * 3))
}

function getPokemonWinPercentage(player: Player) {
  const winsWithoutByes = Math.max(0, player.wins - player.byes)
  const playedRounds = winsWithoutByes + player.losses + player.draws
  if (playedRounds <= 0) return 0
  return clamp(winsWithoutByes / playedRounds, 0.25, 1)
}

function getCompletedOpponentIds(playerId: string, rounds: Round[]) {
  return rounds.flatMap(round =>
    round.matches
      .filter(match => match.result && match.result !== 'bye' && match.p2Id !== 'BYE' && (match.p1Id === playerId || match.p2Id === playerId))
      .map(match => match.p1Id === playerId ? match.p2Id : match.p1Id)
  )
}

function getSonnebornBerger(playerId: string, players: Player[], rounds: Round[]) {
  return rounds.reduce((total, round) => {
    return total + round.matches.reduce((roundTotal, match) => {
      if (!match.result || match.result === 'bye' || match.p2Id === 'BYE') return roundTotal
      if (match.p1Id !== playerId && match.p2Id !== playerId) return roundTotal
      const opponentId = match.p1Id === playerId ? match.p2Id : match.p1Id
      const opponent = players.find(candidate => candidate.id === opponentId)
      return roundTotal + (opponent?.points ?? 0) * getScoreAgainst(playerId, match)
    }, 0)
  }, 0)
}

function getProgressiveScore(playerId: string, rounds: Round[]) {
  let currentScore = 0
  return [...rounds]
    .sort((a, b) => a.number - b.number)
    .reduce((total, round) => {
      const match = round.matches.find(candidate => candidate.p1Id === playerId || candidate.p2Id === playerId)
      if (match?.result) currentScore += getScoreAgainst(playerId, match)
      return total + currentScore
    }, 0)
}

function getHeadToHeadScore(playerId: string, opponentId: string, rounds: Round[]) {
  return rounds.reduce((total, round) => {
    return total + round.matches.reduce((roundTotal, match) => {
      if (!match.result || match.result === 'bye' || match.p2Id === 'BYE') return roundTotal
      const isDirectMatch =
        (match.p1Id === playerId && match.p2Id === opponentId) ||
        (match.p1Id === opponentId && match.p2Id === playerId)
      return isDirectMatch ? roundTotal + getScoreAgainst(playerId, match) : roundTotal
    }, 0)
  }, 0)
}

function getScoreAgainst(playerId: string, match: Match) {
  if (match.result === 'bye') return match.p1Id === playerId ? 3 : 0
  if (match.result === 'draw') return 1
  if (match.result === 'timeout') return 0
  if (match.result === 'p1') return match.p1Id === playerId ? 3 : 0
  if (match.result === 'p2') return match.p2Id === playerId ? 3 : 0
  return 0
}

function cutLow(values: number[]) {
  if (values.length <= 1) return sum(values)
  return sum([...values].sort((a, b) => a - b).slice(1))
}

function cutLowHigh(values: number[]) {
  if (values.length <= 2) return sum(values)
  const sorted = [...values].sort((a, b) => a - b)
  return sum(sorted.slice(1, -1))
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
