import { useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import type { Player, Match, Round } from '../types/tournament'

// Hook de lectura para todo lo derivado del sistema Swiss:
// emparejamientos actuales, clasificacion, resumen de rondas y nombres.
interface StandingsRow {
  player: Player
  position: number
  isEliminated: boolean
}

interface RoundSummary {
  number: number
  matchesTotal: number
  matchesDone: number
  isComplete: boolean
}

interface UseSwissPairingsReturn {
  totalRounds: number
  roundsLeft: number
  isFinalRound: boolean
  shouldFinish: boolean
  currentMatches: Match[]
  allResultsIn: boolean
  unfinishedCount: number
  standings: StandingsRow[]
  roundSummaries: RoundSummary[]
  getPlayerById: (id: string) => Player | undefined
  getPlayerName: (id: string) => string
}

const EMPTY_PLAYERS: Player[] = []
const EMPTY_ROUNDS: Round[] = []

function calcTotalRounds(playerCount: number): number {
  if (playerCount <= 0)  return 0
  if (playerCount <= 2)  return 1
  if (playerCount <= 4)  return 2
  if (playerCount <= 8)  return 3
  if (playerCount <= 16) return 4
  if (playerCount <= 32) return 5
  if (playerCount <= 64) return 6
  return 7
}

export function useSwissPairings(tournamentId: string): UseSwissPairingsReturn {
  // ✅ useShallow evita re-renders cuando el contenido no cambia.
  // Extraemos solo los campos primitivos y arrays que necesitamos,
  // no el objeto torneo entero (que .find() recrea en cada render).
  const { players, rounds, currentRound, status } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        players:      t?.players      ?? EMPTY_PLAYERS,
        rounds:       t?.rounds       ?? EMPTY_ROUNDS,
        currentRound: t?.currentRound ?? 0,
        status:       t?.status       ?? 'setup',
      }
    })
  )

  const totalRounds = useMemo(() => calcTotalRounds(players.length), [players.length])

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

  const currentMatches = useMemo<Match[]>(() => {
    if (!currentRound || !rounds[currentRound - 1]) return []
    return rounds[currentRound - 1].matches
  }, [rounds, currentRound])

  const unfinishedCount = useMemo(
    () => currentMatches.filter(m => m.result === null && m.p2Id !== 'BYE').length,
    [currentMatches]
  )

  const allResultsIn = unfinishedCount === 0 && currentMatches.length > 0

  const standings = useMemo<StandingsRow[]>(() => {
    const sorted = [...players].sort((a, b) => {
      if (b.points !== a.points)               return b.points - a.points
      if (b.wins !== a.wins)                   return b.wins - a.wins
      if (a.timeoutLosses !== b.timeoutLosses) return a.timeoutLosses - b.timeoutLosses
      return a.name.localeCompare(b.name)
    })

    return sorted.map((player, index) => ({
      player,
      position: index + 1,
      isEliminated: player.losses >= 2,
    }))
  }, [players])

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
