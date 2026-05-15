import { useCallback, useMemo } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import type { Player, Match } from '../types/tournament'

interface StandingsRow {
  player: Player
  position: number
  isEliminated: boolean    // true si tiene 2 derrotas (doble derrota)
}

interface RoundSummary {
  number: number
  matchesTotal: number
  matchesDone: number
  isComplete: boolean
}

interface UseSwissPairingsReturn {
  // Metadatos del torneo
  totalRounds: number           // rondas estimadas según nº de jugadores
  roundsLeft: number
  isFinalRound: boolean
  shouldFinish: boolean         // todas las rondas jugadas

  // Ronda actual
  currentMatches: Match[]
  allResultsIn: boolean         // true si todas las partidas tienen resultado
  unfinishedCount: number       // partidas sin resultado en la ronda actual

  // Clasificación ordenada
  standings: StandingsRow[]

  // Historial de rondas
  roundSummaries: RoundSummary[]

  // Helpers de jugadores
  getPlayerById: (id: string) => Player | undefined
  getPlayerName: (id: string) => string
}

// Número de rondas Swiss recomendado según jugadores
function calcTotalRounds(playerCount: number): number {
  if (playerCount <= 0) return 0
  if (playerCount <= 2)  return 1
  if (playerCount <= 4)  return 2
  if (playerCount <= 8)  return 3
  if (playerCount <= 16) return 4
  if (playerCount <= 32) return 5
  if (playerCount <= 64) return 6
  return 7  // hasta 128 jugadores
}

export function useSwissPairings(): UseSwissPairingsReturn {
  const { players, rounds, currentRound, status } = useTournamentStore()

  const totalRounds = useMemo(
    () => calcTotalRounds(players.length),
    [players.length]
  )

  const roundsLeft = useMemo(
    () => Math.max(0, totalRounds - (currentRound > 0 ? currentRound - 1 : 0)),
    [totalRounds, currentRound]
  )

  const isFinalRound = currentRound === totalRounds

  const shouldFinish = useMemo(() => {
    if (status !== 'active') return false
    if (currentRound < totalRounds) return false
    const round = rounds[currentRound - 1]
    if (!round) return false
    return round.matches.every(m => m.result !== null)
  }, [status, currentRound, totalRounds, rounds])

  // ─── Ronda actual ─────────────────────────────────────────────────────────

  const currentMatches = useMemo<Match[]>(() => {
    if (!currentRound || !rounds[currentRound - 1]) return []
    return rounds[currentRound - 1].matches
  }, [rounds, currentRound])

  const unfinishedCount = useMemo(
    () => currentMatches.filter(m => m.result === null && m.p2Id !== 'BYE').length,
    [currentMatches]
  )

  const allResultsIn = unfinishedCount === 0 && currentMatches.length > 0

  // ─── Clasificación ────────────────────────────────────────────────────────

  const standings = useMemo<StandingsRow[]>(() => {
    const sorted = [...players].sort((a, b) => {
      // 1. Puntos
      if (b.points !== a.points) return b.points - a.points
      // 2. Victorias como desempate
      if (b.wins !== a.wins) return b.wins - a.wins
      // 3. Menos derrotas por timeout
      if (a.timeoutLosses !== b.timeoutLosses) return a.timeoutLosses - b.timeoutLosses
      // 4. Alfabético
      return a.name.localeCompare(b.name)
    })

    return sorted.map((player, index) => ({
      player,
      position: index + 1,
      // Eliminado si tiene 2 o más derrotas (contando timeouts)
      isEliminated: (player.losses) >= 2,
    }))
  }, [players])

  // ─── Historial de rondas ──────────────────────────────────────────────────

  const roundSummaries = useMemo<RoundSummary[]>(() => {
    return rounds.map(round => {
      const matchesTotal = round.matches.filter(m => m.p2Id !== 'BYE').length
      const matchesDone  = round.matches.filter(m => m.result !== null && m.p2Id !== 'BYE').length
      return {
        number: round.number,
        matchesTotal,
        matchesDone,
        isComplete: matchesTotal === matchesDone,
      }
    })
  }, [rounds])

  // ─── Helpers de jugadores ─────────────────────────────────────────────────

  const getPlayerById = useCallback(
    (id: string) => players.find(p => p.id === id),
    [players]
  )

  const getPlayerName = useCallback(
    (id: string) => {
      if (id === 'BYE') return 'BYE'
      return players.find(p => p.id === id)?.name ?? 'Desconocido'
    },
    [players]
  )

  return {
    totalRounds,
    roundsLeft,
    isFinalRound,
    shouldFinish,
    currentMatches,
    allResultsIn,
    unfinishedCount,
    standings,
    roundSummaries,
    getPlayerById,
    getPlayerName,
  }
}