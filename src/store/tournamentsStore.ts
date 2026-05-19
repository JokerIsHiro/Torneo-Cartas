import { create } from 'zustand'
import type {
  Tournament,
  Player,
  Match,
  Round,
  MatchResult,
  PendingMatchResult,
  TournamentTCG,
} from '../types/tournament'
import { deleteRemoteTournament, getCurrentUserId, saveRemoteTournament } from '../services/firebase'

// Cache en memoria de torneos. Firestore es la fuente de verdad; Zustand solo
// alimenta la UI y calcula los siguientes estados antes de enviarlos.

// ─── Helpers de emparejamiento Swiss ─────────────────────────────────────────

function generatePairings(players: Player[], roundNumber: number, tournamentId: string): Match[] {
  // Ordenamos por puntos para emparejar jugadores con rendimiento parecido.
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.name.localeCompare(b.name)
  })

  const paired = new Set<string>()
  const matches: Match[] = []
  let tableNumber = 1
  let byePlayer: Player | null = null

  // Si hay numero impar de jugadores, asignamos BYE a quien aun no lo haya recibido.
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

  // Intentamos evitar repetir rivales. Si no hay alternativa, emparejamos igualmente.
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
  // Recalcula estadisticas de los dos jugadores afectados por una partida.
  return players.map(p => {
    if (p.id !== match.p1Id && p.id !== match.p2Id) return p

    const isP1 = p.id === match.p1Id
    const updated = { ...p }

    // Revertir resultado anterior antes de aplicar el nuevo.
    if (match.result && match.result !== 'bye') {
      if (match.result === 'p1' && isP1)   { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p1' && !isP1)  { updated.losses -= 1 }
      if (match.result === 'p2' && !isP1)  { updated.points -= 3; updated.wins -= 1 }
      if (match.result === 'p2' && isP1)   { updated.losses -= 1 }
      if (match.result === 'draw')         { updated.points -= 1; updated.draws -= 1 }
      if (match.result === 'timeout')      { updated.losses -= 1; updated.timeoutLosses -= 1 }
    }

    // Aplicar nuevo resultado.
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
  // El BYE cuenta como victoria automatica para el jugador que descansa.
  return players.map(p =>
    p.id === byeMatch.p1Id
      ? { ...p, points: p.points + 3, wins: p.wins + 1, byes: p.byes + 1 }
      : p
  )
}

function syncRemoteTournament(tournament: Tournament | undefined) {
  if (!tournament) return
  void saveRemoteTournament(tournament).catch(error => {
    console.error('No se ha podido sincronizar el torneo con Firebase', error)
  })
}

function syncRemoteDelete(tournamentId: string) {
  void deleteRemoteTournament(tournamentId).catch(error => {
    console.error('No se ha podido eliminar el torneo en Firebase', error)
  })
}

function touchTournament<T extends Tournament>(tournament: T): T {
  return { ...tournament, updatedAt: Date.now() }
}

function replaceTournament(
  set: (partial: TournamentsStore | Partial<TournamentsStore> | ((state: TournamentsStore) => TournamentsStore | Partial<TournamentsStore>)) => void,
  tournament: Tournament
) {
  set(s => ({
    tournaments: s.tournaments.map(t => t.id === tournament.id ? tournament : t),
  }))
  syncRemoteTournament(tournament)
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface TournamentsStore {
  tournaments: Tournament[]
  syncEnabled: boolean
  syncLoaded: boolean

  // Gestión de torneos
  createTournament: () => string                          // devuelve el id
  deleteTournament: (id: string) => void
  setRemoteTournaments: (tournaments: Tournament[]) => void
  setSyncEnabled: (enabled: boolean) => void
  setSyncLoaded: (loaded: boolean) => void
  updateTournamentName: (id: string, name: string) => void
  setTournamentTCG: (id: string, tcg: TournamentTCG) => void
  setTimerDuration: (id: string, seconds: number) => void

  // Jugadores
  addPlayer: (id: string, name: string) => string | null
  removePlayer: (id: string, playerId: string) => void

  // Torneo
  startTournament: (id: string) => void
  nextRound: (id: string) => void
  setMatchResult: (id: string, matchId: string, result: MatchResult) => void
  submitPlayerResult: (id: string, matchId: string, playerId: string, result: PendingMatchResult['result']) => void
  approvePendingResult: (id: string, pendingResultId: string) => void
  rejectPendingResult: (id: string, pendingResultId: string) => void
  applyTimeoutToUnfinished: (id: string) => void
  finishTournament: (id: string) => void
}

export const useTournamentsStore = create<TournamentsStore>()(
    (set, get) => ({
      tournaments: [],
      syncEnabled: false,
      syncLoaded: false,

      createTournament: () => {
        const id = crypto.randomUUID()
        const newTournament: Tournament = {
          id,
          organizerUid: getCurrentUserId() ?? undefined,
          name: 'Nuevo torneo',
          tcg: 'magic',
          players: [],
          rounds: [],
          pendingResults: [],
          currentRound: 0,
          status: 'setup',
          timerDuration: 50 * 60,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set(s => ({ tournaments: [...s.tournaments, newTournament] }))
        syncRemoteTournament(newTournament)
        return id
      },

      deleteTournament: (id) => {
        set(s => ({ tournaments: s.tournaments.filter(t => t.id !== id) }))
        syncRemoteDelete(id)
      },

      setRemoteTournaments: (tournaments) => {
        set({ tournaments, syncLoaded: true })
      },

      setSyncEnabled: (enabled) => {
        set({ syncEnabled: enabled })
      },

      setSyncLoaded: (loaded) => {
        set({ syncLoaded: loaded })
      },

      updateTournamentName: (id, name) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        replaceTournament(set, touchTournament({ ...tournament, name }))
      },

      setTournamentTCG: (id, tcg) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        replaceTournament(set, touchTournament({ ...tournament, tcg }))
      },

      setTimerDuration: (id, seconds) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        replaceTournament(set, touchTournament({ ...tournament, timerDuration: seconds }))
      },

      addPlayer: (id, name) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return null
        if (tournament.players.find(p => p.name.toLowerCase() === name.toLowerCase())) return null

        const newPlayer: Player = {
          id: crypto.randomUUID(),
          uid: getCurrentUserId() ?? undefined,
          name,
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          byes: 0,
          timeoutLosses: 0,
          opponents: [],
        }

        replaceTournament(set, touchTournament({ ...tournament, players: [...tournament.players, newPlayer] }))
        return newPlayer.id
      },

      removePlayer: (id, playerId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return

        replaceTournament(set, touchTournament({
          ...tournament,
          players: tournament.players.filter(p => p.id !== playerId),
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

        replaceTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: [firstRound],
          currentRound: 1,
          status: 'active',
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
        const pendingResults = (tournament.pendingResults ?? []).filter(p => p.matchId !== matchId)

        replaceTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: updatedRounds,
          pendingResults,
        }))
      },

      submitPlayerResult: (id, matchId, playerId, result) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'active') return
        if ((tournament.tcg ?? 'magic') === 'yugioh' && result === 'draw') return

        const round = tournament.rounds[tournament.currentRound - 1]
        const match = round?.matches.find(m => m.id === matchId)
        if (!match || match.result !== null || match.p2Id === 'BYE') return
        if (match.p1Id !== playerId && match.p2Id !== playerId) return

        const pendingResult: PendingMatchResult = {
          id: crypto.randomUUID(),
          submittedByUid: getCurrentUserId() ?? undefined,
          roundNumber: tournament.currentRound,
          matchId,
          playerId,
          result,
          createdAt: Date.now(),
        }

        const pendingResults = (tournament.pendingResults ?? []).filter(p =>
          !(p.matchId === matchId && p.playerId === playerId)
        )
        replaceTournament(set, touchTournament({
          ...tournament,
          pendingResults: [...pendingResults, pendingResult],
        }))
      },

      approvePendingResult: (id, pendingResultId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        const pendingResult = tournament?.pendingResults?.find(p => p.id === pendingResultId)
        if (!tournament || !pendingResult) return
        get().setMatchResult(id, pendingResult.matchId, pendingResult.result)
      },

      rejectPendingResult: (id, pendingResultId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        replaceTournament(set, touchTournament({
          ...tournament,
          pendingResults: (tournament.pendingResults ?? []).filter(p => p.id !== pendingResultId),
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
        const pendingResults = (tournament.pendingResults ?? []).filter(p =>
          !unfinished.some(match => match.id === p.matchId)
        )

        replaceTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: updatedRounds,
          pendingResults,
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

        replaceTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: [...closedRounds, newRound],
          pendingResults: [],
          currentRound: nextRoundNumber,
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

        replaceTournament(set, touchTournament({
          ...tournament,
          rounds: closedRounds,
          pendingResults: [],
          status: 'finished',
        }))
      },
    })
)

// Helper para obtener un torneo por id sin suscribirse a todo el store
export function getTournament(id: string) {
  return useTournamentsStore.getState().tournaments.find(t => t.id === id)
}
