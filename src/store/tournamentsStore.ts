import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Tournament,
  Player,
  Match,
  Round,
  MatchResult,
  TournamentTCG,
} from '../types/tournament'

// ─── Helpers de emparejamiento Swiss ─────────────────────────────────────────

function generatePairings(players: Player[], roundNumber: number, tournamentId: string): Match[] {
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.name.localeCompare(b.name)
  })

  const paired = new Set<string>()
  const matches: Match[] = []
  let tableNumber = 1
  let byePlayer: Player | null = null

  if (sorted.length % 2 !== 0) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].byes === 0) {
        byePlayer = sorted[i]
        sorted.splice(i, 1)
        break
      }
    }
    if (!byePlayer) {
      byePlayer = sorted[sorted.length - 1]
      sorted.splice(sorted.length - 1, 1)
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].id)) continue

    let matched = false
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].id)) continue
      if (!sorted[i].opponents.includes(sorted[j].id)) {
        matches.push({
          id: `${tournamentId}-r${roundNumber}-t${tableNumber}`,
          tableNumber: tableNumber++,
          p1Id: sorted[i].id,
          p2Id: sorted[j].id,
          result: null,
        })
        paired.add(sorted[i].id)
        paired.add(sorted[j].id)
        matched = true
        break
      }
    }

    if (!matched) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (paired.has(sorted[j].id)) continue
        matches.push({
          id: `${tournamentId}-r${roundNumber}-t${tableNumber}`,
          tableNumber: tableNumber++,
          p1Id: sorted[i].id,
          p2Id: sorted[j].id,
          result: null,
        })
        paired.add(sorted[i].id)
        paired.add(sorted[j].id)
        break
      }
    }
  }

  if (byePlayer) {
    matches.push({
      id: `${tournamentId}-r${roundNumber}-bye`,
      tableNumber: tableNumber,
      p1Id: byePlayer.id,
      p2Id: 'BYE',
      result: 'bye',
    })
  }

  return matches
}

function applyResult(players: Player[], match: Match, result: MatchResult): Player[] {
  return players.map(p => {
    if (p.id !== match.p1Id && p.id !== match.p2Id) return p

    const isP1 = p.id === match.p1Id
    const updated = { ...p }

    // Revertir anterior
    if (match.result && match.result !== 'bye') {
      if (match.result === 'p1' && isP1)   { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p1' && !isP1)  { updated.losses -= 1 }
      if (match.result === 'p2' && !isP1)  { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p2' && isP1)   { updated.losses -= 1 }
      if (match.result === 'draw')         { updated.points -= 1; updated.draws -= 1 }
      if (match.result === 'timeout')      { updated.losses -= 1; updated.timeoutLosses -= 1 }
    }

    // Aplicar nuevo
    if (result === 'p1' && isP1)   { updated.points += 3; updated.wins += 1 }
    if (result === 'p1' && !isP1)  { updated.losses += 1 }
    if (result === 'p2' && !isP1)  { updated.points += 3; updated.wins += 1 }
    if (result === 'p2' && isP1)   { updated.losses += 1 }
    if (result === 'draw')         { updated.points += 1; updated.draws += 1 }
    if (result === 'timeout')      { updated.losses += 1; updated.timeoutLosses += 1 }

    if (match.p2Id !== 'BYE') {
      const rivalId = isP1 ? match.p2Id : match.p1Id
      if (!updated.opponents.includes(rivalId)) {
        updated.opponents = [...updated.opponents, rivalId]
      }
    }

    return updated
  })
}

function applyByeToPlayers(players: Player[], byeMatch: Match): Player[] {
  return players.map(p =>
    p.id === byeMatch.p1Id
      ? { ...p, points: p.points + 3, wins: p.wins + 1, byes: p.byes + 1 }
      : p
  )
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface TournamentsStore {
  tournaments: Tournament[]

  // Gestión de torneos
  createTournament: () => string                          // devuelve el id
  deleteTournament: (id: string) => void
  updateTournamentName: (id: string, name: string) => void
  setTournamentTCG: (id: string, tcg: TournamentTCG) => void
  setTimerDuration: (id: string, seconds: number) => void

  // Jugadores
  addPlayer: (id: string, name: string) => void
  removePlayer: (id: string, playerId: string) => void

  // Torneo
  startTournament: (id: string) => void
  nextRound: (id: string) => void
  setMatchResult: (id: string, matchId: string, result: MatchResult) => void
  applyTimeoutToUnfinished: (id: string) => void
  finishTournament: (id: string) => void
}

export const useTournamentsStore = create<TournamentsStore>()(
  persist(
    (set, get) => ({
      tournaments: [],

      createTournament: () => {
        const id = crypto.randomUUID()
        const newTournament: Tournament = {
          id,
          name: 'Nuevo torneo',
          tcg: 'magic',
          players: [],
          rounds: [],
          currentRound: 0,
          status: 'setup',
          timerDuration: 50 * 60,
          createdAt: Date.now(),
        }
        set(s => ({ tournaments: [...s.tournaments, newTournament] }))
        return id
      },

      deleteTournament: (id) => {
        set(s => ({ tournaments: s.tournaments.filter(t => t.id !== id) }))
      },

      updateTournamentName: (id, name) => {
        set(s => ({
          tournaments: s.tournaments.map(t => t.id === id ? { ...t, name } : t),
        }))
      },

      setTournamentTCG: (id, tcg) => {
        set(s => ({
          tournaments: s.tournaments.map(t => t.id === id ? { ...t, tcg } : t),
        }))
      },

      setTimerDuration: (id, seconds) => {
        set(s => ({
          tournaments: s.tournaments.map(t => t.id === id ? { ...t, timerDuration: seconds } : t),
        }))
      },

      addPlayer: (id, name) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return
        if (tournament.players.find(p => p.name.toLowerCase() === name.toLowerCase())) return

        const newPlayer: Player = {
          id: crypto.randomUUID(),
          name,
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          byes: 0,
          timeoutLosses: 0,
          opponents: [],
        }

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id ? { ...t, players: [...t.players, newPlayer] } : t
          ),
        }))
      },

      removePlayer: (id, playerId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id
              ? { ...t, players: t.players.filter(p => p.id !== playerId) }
              : t
          ),
        }))
      },

      startTournament: (id) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.players.length < 2) return

        const matches = generatePairings(tournament.players, 1, id)
        let updatedPlayers = tournament.players
        const byeMatch = matches.find(m => m.p2Id === 'BYE')
        if (byeMatch) updatedPlayers = applyByeToPlayers(updatedPlayers, byeMatch)

        const firstRound: Round = {
          number: 1,
          matches,
          startedAt: Date.now(),
          endedAt: null,
        }

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id
              ? { ...t, players: updatedPlayers, rounds: [firstRound], currentRound: 1, status: 'active' }
              : t
          ),
        }))
      },

      setMatchResult: (id, matchId, result) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        if ((tournament.tcg ?? 'magic') === 'yugioh' && result === 'draw') return

        const round = tournament.rounds[tournament.currentRound - 1]
        const match = round?.matches.find(m => m.id === matchId)
        if (!match || match.p2Id === 'BYE') return

        const updatedPlayers = applyResult(tournament.players, match, result)
        const updatedRounds = tournament.rounds.map(r =>
          r.number === tournament.currentRound
            ? { ...r, matches: r.matches.map(m => m.id === matchId ? { ...m, result } : m) }
            : r
        )

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id ? { ...t, players: updatedPlayers, rounds: updatedRounds } : t
          ),
        }))
      },

      applyTimeoutToUnfinished: (id) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return

        const round = tournament.rounds[tournament.currentRound - 1]
        const unfinished = round?.matches.filter(m => m.result === null && m.p2Id !== 'BYE')
        if (!unfinished?.length) return

        let updatedPlayers = tournament.players
        const updatedMatches = round.matches.map(m => {
          if (m.result !== null || m.p2Id === 'BYE') return m
          updatedPlayers = applyResult(updatedPlayers, m, 'timeout')
          return { ...m, result: 'timeout' as MatchResult }
        })

        const updatedRounds = tournament.rounds.map(r =>
          r.number === tournament.currentRound ? { ...r, matches: updatedMatches } : r
        )

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id ? { ...t, players: updatedPlayers, rounds: updatedRounds } : t
          ),
        }))
      },

      nextRound: (id) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return

        const round = tournament.rounds[tournament.currentRound - 1]
        if (!round.matches.every(m => m.result !== null)) return

        const nextRoundNumber = tournament.currentRound + 1
        const matches = generatePairings(tournament.players, nextRoundNumber, id)

        let updatedPlayers = tournament.players
        const byeMatch = matches.find(m => m.p2Id === 'BYE')
        if (byeMatch) updatedPlayers = applyByeToPlayers(updatedPlayers, byeMatch)

        const closedRounds = tournament.rounds.map(r =>
          r.number === tournament.currentRound ? { ...r, endedAt: Date.now() } : r
        )

        const newRound: Round = {
          number: nextRoundNumber,
          matches,
          startedAt: Date.now(),
          endedAt: null,
        }

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id
              ? {
                  ...t,
                  players: updatedPlayers,
                  rounds: [...closedRounds, newRound],
                  currentRound: nextRoundNumber,
                }
              : t
          ),
        }))
      },

      finishTournament: (id) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return

        const round = tournament.rounds[tournament.currentRound - 1]
        if (!round.matches.every(m => m.result !== null)) return

        const closedRounds = tournament.rounds.map(r =>
          r.number === tournament.currentRound ? { ...r, endedAt: Date.now() } : r
        )

        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id ? { ...t, rounds: closedRounds, status: 'finished' } : t
          ),
        }))
      },
    }),
    { name: 'torneos-storage' }
  )
)

// Helper para obtener un torneo por id sin suscribirse a todo el store
export function getTournament(id: string) {
  return useTournamentsStore.getState().tournaments.find(t => t.id === id)
}
