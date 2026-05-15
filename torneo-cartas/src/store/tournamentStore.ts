import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Player, Match, Round, TournamentState, MatchResult } from '../types/tournament'

interface TournamentStore extends TournamentState {
  setTournamentName: (name: string) => void
  addPlayer: (name: string) => void
  removePlayer: (id: string) => void
  setTimerDuration: (seconds: number) => void
  startTournament: () => void
  nextRound: () => void
  setMatchResult: (matchId: string, result: MatchResult) => void
  applyTimeoutToUnfinished: () => void
  finishTournament: () => void
  resetTournament: () => void
}

const initialState: TournamentState = {
  name: 'Mi Torneo',
  players: [],
  rounds: [],
  currentRound: 0,
  status: 'setup',
  timerDuration: 50 * 60,
}

// ─── Emparejamiento Swiss ─────────────────────────────────────────────────────

function generatePairings(players: Player[], roundNumber: number): Match[] {
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
          id: `r${roundNumber}-t${tableNumber}`,
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
          id: `r${roundNumber}-t${tableNumber}`,
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
      id: `r${roundNumber}-bye`,
      tableNumber: tableNumber,
      p1Id: byePlayer.id,
      p2Id: 'BYE',
      result: 'bye',
    })
  }

  return matches
}

// ─── Aplicar / revertir resultado ────────────────────────────────────────────

function applyResult(
  players: Player[],
  match: Match,
  result: MatchResult
): Player[] {
  return players.map(p => {
    if (p.id !== match.p1Id && p.id !== match.p2Id) return p

    const isP1 = p.id === match.p1Id
    const updated = { ...p }

    // Revertir resultado anterior
    if (match.result && match.result !== 'bye') {
      if (match.result === 'p1' && isP1)   { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p1' && !isP1)  { updated.losses -= 1 }
      if (match.result === 'p2' && !isP1)  { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p2' && isP1)   { updated.losses -= 1 }
      if (match.result === 'draw')         { updated.points -= 1; updated.draws -= 1 }
      if (match.result === 'timeout')      { updated.losses -= 1; updated.timeoutLosses -= 1 }
    }

    // Aplicar nuevo resultado
    if (result === 'p1' && isP1)   { updated.points += 3; updated.wins += 1 }
    if (result === 'p1' && !isP1)  { updated.losses += 1 }
    if (result === 'p2' && !isP1)  { updated.points += 3; updated.wins += 1 }
    if (result === 'p2' && isP1)   { updated.losses += 1 }
    if (result === 'draw')         { updated.points += 1; updated.draws += 1 }
    if (result === 'timeout')      { updated.losses += 1; updated.timeoutLosses += 1 }

    // Registrar rival
    if (match.p2Id !== 'BYE') {
      const rivalId = isP1 ? match.p2Id : match.p1Id
      if (!updated.opponents.includes(rivalId)) {
        updated.opponents = [...updated.opponents, rivalId]
      }
    }

    return updated
  })
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTournamentName: (name) => set({ name }),

      addPlayer: (name) => {
        const { players, status } = get()
        if (status !== 'setup') return
        if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) return

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
        set({ players: [...players, newPlayer] })
      },

      removePlayer: (id) => {
        const { status, players } = get()
        if (status !== 'setup') return
        set({ players: players.filter(p => p.id !== id) })
      },

      setTimerDuration: (seconds) => set({ timerDuration: seconds }),

      startTournament: () => {
        const { players } = get()
        if (players.length < 2) return

        const matches = generatePairings(players, 1)

        let updatedPlayers = players
        const byeMatch = matches.find(m => m.p2Id === 'BYE')
        if (byeMatch) {
          updatedPlayers = players.map(p =>
            p.id === byeMatch.p1Id
              ? { ...p, points: p.points + 3, wins: p.wins + 1, byes: p.byes + 1 }
              : p
          )
        }

        const firstRound: Round = {
          number: 1,
          matches,
          startedAt: Date.now(),
          endedAt: null,
        }

        set({
          players: updatedPlayers,
          rounds: [firstRound],
          currentRound: 1,
          status: 'active',
        })
      },

      setMatchResult: (matchId, result) => {
        const { rounds, players, currentRound } = get()
        const round = rounds[currentRound - 1]
        const match = round.matches.find(m => m.id === matchId)
        if (!match || match.p2Id === 'BYE') return

        const updatedPlayers = applyResult(players, match, result)
        const updatedRounds = rounds.map(r =>
          r.number === currentRound
            ? { ...r, matches: r.matches.map(m => m.id === matchId ? { ...m, result } : m) }
            : r
        )

        set({ players: updatedPlayers, rounds: updatedRounds })
      },

      // Llamado por useTimer cuando el tiempo llega a cero
      applyTimeoutToUnfinished: () => {
        const { rounds, players, currentRound } = get()
        const round = rounds[currentRound - 1]

        const unfinished = round.matches.filter(
          m => m.result === null && m.p2Id !== 'BYE'
        )
        if (!unfinished.length) return

        let updatedPlayers = players
        const updatedMatches = round.matches.map(m => {
          if (m.result !== null || m.p2Id === 'BYE') return m
          updatedPlayers = applyResult(updatedPlayers, m, 'timeout')
          return { ...m, result: 'timeout' as MatchResult }
        })

        const updatedRounds = rounds.map(r =>
          r.number === currentRound ? { ...r, matches: updatedMatches } : r
        )

        set({ players: updatedPlayers, rounds: updatedRounds })
      },

      nextRound: () => {
        const { rounds, players, currentRound } = get()
        const round = rounds[currentRound - 1]
        const allDone = round.matches.every(m => m.result !== null)
        if (!allDone) return

        const nextRoundNumber = currentRound + 1
        const matches = generatePairings(players, nextRoundNumber)

        let updatedPlayers = players
        const byeMatch = matches.find(m => m.p2Id === 'BYE')
        if (byeMatch) {
          updatedPlayers = players.map(p =>
            p.id === byeMatch.p1Id
              ? { ...p, points: p.points + 3, wins: p.wins + 1, byes: p.byes + 1 }
              : p
          )
        }

        const closedRounds = rounds.map(r =>
          r.number === currentRound ? { ...r, endedAt: Date.now() } : r
        )

        const newRound: Round = {
          number: nextRoundNumber,
          matches,
          startedAt: Date.now(),
          endedAt: null,
        }

        set({
          players: updatedPlayers,
          rounds: [...closedRounds, newRound],
          currentRound: nextRoundNumber,
        })
      },

      finishTournament: () => {
        const { rounds, currentRound } = get()
        const round = rounds[currentRound - 1]
        const allDone = round.matches.every(m => m.result !== null)
        if (!allDone) return

        const closedRounds = rounds.map(r =>
          r.number === currentRound ? { ...r, endedAt: Date.now() } : r
        )
        set({ rounds: closedRounds, status: 'finished' })
      },

      resetTournament: () => set({ ...initialState }),
    }),
    {
      name: 'torneo-cartas-storage',
    }
  )
)