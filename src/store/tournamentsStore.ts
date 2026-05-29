import { create } from 'zustand'
import type {
  Tournament,
  Player,
  DeckList,
  Match,
  Round,
  MatchResult,
  MagicFormat,
  PendingMatchResult,
  TournamentSnapshot,
  TournamentSnapshotAction,
  TournamentSnapshotData,
  TournamentTCG,
  TournamentTeamMode,
  TournamentPhaseMode,
  TournamentTiebreakerSystem,
} from '../types/tournament'
import { deleteRemoteTournament, getCurrentUserId, saveRemoteTournament } from '../services/firebase'
import { getDefaultTiebreakerSystem } from '../utils/tiebreakers'

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

function rebuildPlayersFromRounds(players: Player[], rounds: Round[]): Player[] {
  // Cuando se corrige una ronda antigua, reconstruimos la clasificacion completa
  // desde el historial para no dejar puntos duplicados o estadisticas antiguas.
  const firstRoundByPlayer = new Map<string, number>()

  rounds.forEach(round => {
    round.matches.forEach(match => {
      const candidates = match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
      candidates.forEach(playerId => {
        const previous = firstRoundByPlayer.get(playerId)
        if (!previous || round.number < previous) {
          firstRoundByPlayer.set(playerId, round.number)
        }
      })
    })
  })

  let rebuiltPlayers: Player[] = players.map(player => {
    const firstRound = firstRoundByPlayer.get(player.id) ?? 1
    const initialLosses = Math.max(0, firstRound - 1)
    return {
      ...player,
      points: 0,
      wins: 0,
      losses: initialLosses,
      draws: 0,
      byes: 0,
      timeoutLosses: 0,
      opponents: [] as string[],
    }
  })

  rounds
    .slice()
    .sort((a, b) => a.number - b.number)
    .forEach(round => {
      round.matches.forEach(match => {
        if (!match.result) return
        if (match.result === 'bye') {
          rebuiltPlayers = applyByeToPlayers(rebuiltPlayers, match)
          return
        }
        rebuiltPlayers = applyResult(rebuiltPlayers, { ...match, result: null }, match.result)
      })
    })

  return rebuiltPlayers
}

const pendingTournamentWrites = new Map<string, Tournament>()
const pendingTournamentDeletes = new Set<string>()
const TOURNAMENT_CACHE_KEY = 'subterra-tournament-cache-v1'

function loadCachedTournaments(): Tournament[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOURNAMENT_CACHE_KEY) ?? '[]') as Tournament[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCachedTournaments(tournaments: Tournament[]) {
  try {
    localStorage.setItem(TOURNAMENT_CACHE_KEY, JSON.stringify(tournaments.slice(-80)))
  } catch {
    // El cache local es solo una red de seguridad para pestanas nuevas.
  }
}

function cacheTournament(tournament: Tournament) {
  const cached = loadCachedTournaments().filter(candidate => candidate.id !== tournament.id)
  saveCachedTournaments([...cached, tournament].sort((a, b) => a.createdAt - b.createdAt))
}

function uncacheTournament(tournamentId: string) {
  saveCachedTournaments(loadCachedTournaments().filter(candidate => candidate.id !== tournamentId))
}

function touchTournament<T extends Tournament>(tournament: T): T {
  return { ...tournament, updatedAt: Date.now() }
}

function createEmptyTournament(): Tournament {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    organizerUid: getCurrentUserId() ?? undefined,
    name: 'Nuevo torneo',
    tcg: 'magic',
    magicFormat: 'pauper',
    teamMode: 'solo',
    phaseMode: 'swiss',
    topCut: 8,
    players: [],
    rounds: [],
    pendingResults: [],
    decklists: [],
    snapshots: [],
    currentRound: 0,
    status: 'setup',
    timerDuration: 50 * 60,
    tiebreakerSystem: getDefaultTiebreakerSystem('magic'),
    createdAt: now,
    updatedAt: now,
  }
}

function snapshotData(tournament: Tournament): TournamentSnapshotData {
  const data: Partial<Tournament> = { ...tournament }
  delete data.snapshots
  return data as TournamentSnapshotData
}

function withSnapshot(tournament: Tournament, action: TournamentSnapshotAction, label: string): Tournament {
  const snapshot: TournamentSnapshot = {
    id: crypto.randomUUID(),
    action,
    label,
    createdAt: Date.now(),
    data: snapshotData(tournament),
  }

  return {
    ...tournament,
    snapshots: [snapshot, ...(tournament.snapshots ?? [])].slice(0, 12),
  }
}

function applyPendingWrites(remoteTournaments: Tournament[]) {
  const byId = new Map<string, Tournament>()

  for (const tournament of [...loadCachedTournaments(), ...remoteTournaments]) {
    const current = byId.get(tournament.id)
    if (!current || tournament.updatedAt >= current.updatedAt) {
      byId.set(tournament.id, tournament)
    }
  }

  for (const tournamentId of pendingTournamentDeletes) {
    byId.delete(tournamentId)
  }

  for (const [tournamentId, pendingTournament] of pendingTournamentWrites) {
    const remoteTournament = byId.get(tournamentId)
    if (!remoteTournament || pendingTournament.updatedAt >= remoteTournament.updatedAt) {
      byId.set(tournamentId, pendingTournament)
    }
  }

  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
}

function commitTournament(
  set: (partial: TournamentsStore | Partial<TournamentsStore> | ((state: TournamentsStore) => TournamentsStore | Partial<TournamentsStore>)) => void,
  tournament: Tournament
) {
  pendingTournamentWrites.set(tournament.id, tournament)
  cacheTournament(tournament)
  set(s => ({
    tournaments: s.tournaments.map(t => t.id === tournament.id ? tournament : t),
  }))
  void saveRemoteTournament(tournament)
    .then(() => {
      const pendingTournament = pendingTournamentWrites.get(tournament.id)
      if (pendingTournament?.updatedAt === tournament.updatedAt) {
        pendingTournamentWrites.delete(tournament.id)
      }
    })
    .catch(error => {
      const pendingTournament = pendingTournamentWrites.get(tournament.id)
      if (pendingTournament?.updatedAt === tournament.updatedAt) {
        pendingTournamentWrites.delete(tournament.id)
      }
      console.error('No se ha podido sincronizar el torneo con Firebase', error)
    })
}

function commitNewTournament(
  set: (partial: TournamentsStore | Partial<TournamentsStore> | ((state: TournamentsStore) => TournamentsStore | Partial<TournamentsStore>)) => void,
  tournament: Tournament
) {
  pendingTournamentWrites.set(tournament.id, tournament)
  cacheTournament(tournament)
  set(s => ({ tournaments: [...s.tournaments, tournament] }))
  void saveRemoteTournament(tournament)
    .then(() => {
      const pendingTournament = pendingTournamentWrites.get(tournament.id)
      if (pendingTournament?.updatedAt === tournament.updatedAt) {
        pendingTournamentWrites.delete(tournament.id)
      }
    })
    .catch(error => {
      const pendingTournament = pendingTournamentWrites.get(tournament.id)
      if (pendingTournament?.updatedAt === tournament.updatedAt) {
        pendingTournamentWrites.delete(tournament.id)
      }
      console.error('No se ha podido sincronizar el torneo con Firebase', error)
    })
}

function commitTournamentDelete(
  set: (partial: TournamentsStore | Partial<TournamentsStore> | ((state: TournamentsStore) => TournamentsStore | Partial<TournamentsStore>)) => void,
  tournamentId: string
) {
  pendingTournamentWrites.delete(tournamentId)
  pendingTournamentDeletes.add(tournamentId)
  uncacheTournament(tournamentId)
  set(s => ({ tournaments: s.tournaments.filter(t => t.id !== tournamentId) }))

  void deleteRemoteTournament(tournamentId)
    .then(() => {
      pendingTournamentDeletes.delete(tournamentId)
    })
    .catch(error => {
      pendingTournamentDeletes.delete(tournamentId)
      console.error('No se ha podido eliminar el torneo en Firebase', error)
    })
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
  setTournamentMagicFormat: (id: string, format: MagicFormat) => void
  setTournamentTeamMode: (id: string, mode: TournamentTeamMode) => void
  setTournamentPhaseMode: (id: string, mode: TournamentPhaseMode) => void
  setTournamentTopCut: (id: string, topCut: number) => void
  setTimerDuration: (id: string, seconds: number) => void
  setTiebreakerSystem: (id: string, system: TournamentTiebreakerSystem) => void

  // Jugadores
  addPlayer: (id: string, name: string, teamDetails?: { members: string[]; captainName: string }) => string | null
  removePlayer: (id: string, playerId: string) => void
  submitDecklist: (id: string, playerId: string, deck: { name: string; list: string; notes: string; playerName?: string; teamName?: string }) => void
  publishDecklist: (id: string, deckId: string, published: boolean) => void

  // Torneo
  createSnapshot: (id: string, action: TournamentSnapshotAction, label: string) => void
  restoreSnapshot: (id: string, snapshotId: string) => void
  startTournament: (id: string) => void
  nextRound: (id: string) => void
  setMatchResult: (id: string, matchId: string, result: MatchResult) => void
  setRoundMatchResult: (id: string, roundNumber: number, matchId: string, result: MatchResult) => void
  swapCurrentRoundPlayers: (id: string, firstMatchId: string, firstPlayerId: string, secondMatchId: string, secondPlayerId: string) => void
  addLatePlayerToCurrentRound: (id: string, name: string) => 'added-to-round' | 'added-next-round' | 'duplicate' | 'closed' | 'has-results'
  submitPlayerResult: (id: string, matchId: string, playerId: string, result: PendingMatchResult['result']) => void
  approvePendingResult: (id: string, pendingResultId: string) => void
  rejectPendingResult: (id: string, pendingResultId: string) => void
  applyTimeoutToUnfinished: (id: string) => void
  finishTournament: (id: string) => void
}

export const useTournamentsStore = create<TournamentsStore>()(
    (set, get) => ({
      tournaments: loadCachedTournaments(),
      syncEnabled: false,
      syncLoaded: false,

      createTournament: () => {
        const newTournament = createEmptyTournament()
        commitNewTournament(set, newTournament)
        return newTournament.id
      },

      deleteTournament: (id) => {
        commitTournamentDelete(set, id)
      },

      setRemoteTournaments: (tournaments) => {
        const merged = applyPendingWrites(tournaments)
        saveCachedTournaments(merged)
        set({ tournaments: merged, syncLoaded: true })
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
        commitTournament(set, touchTournament({ ...tournament, name }))
      },

      setTournamentTCG: (id, tcg) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        commitTournament(set, touchTournament({
          ...tournament,
          tcg,
          magicFormat: tcg === 'magic' ? (tournament.magicFormat ?? 'pauper') : tournament.magicFormat,
          tiebreakerSystem: getDefaultTiebreakerSystem(tcg),
        }))
      },

      setTournamentMagicFormat: (id, format) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        commitTournament(set, touchTournament({ ...tournament, magicFormat: format }))
      },

      setTournamentTeamMode: (id, mode) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return
        commitTournament(set, touchTournament({ ...tournament, teamMode: mode }))
      },

      setTournamentPhaseMode: (id, mode) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return
        commitTournament(set, touchTournament({ ...tournament, phaseMode: mode }))
      },

      setTournamentTopCut: (id, topCut) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return
        const safeTopCut = Math.max(2, Math.min(128, Math.floor(topCut || 2)))
        commitTournament(set, touchTournament({ ...tournament, topCut: safeTopCut }))
      },

      setTimerDuration: (id, seconds) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        commitTournament(set, touchTournament({ ...tournament, timerDuration: seconds }))
      },

      setTiebreakerSystem: (id, system) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        commitTournament(set, touchTournament({ ...tournament, tiebreakerSystem: system }))
      },

      addPlayer: (id, name, teamDetails) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return null
        if (tournament.players.find(p => p.name.toLowerCase() === name.toLowerCase())) return null

        const members = teamDetails?.members.map(member => member.trim()).filter(Boolean)
        const captainName = teamDetails?.captainName.trim()
        const newPlayer: Player = {
          id: crypto.randomUUID(),
          uid: getCurrentUserId() ?? undefined,
          name,
          teamMembers: members?.length ? members : undefined,
          captainName: captainName || members?.[0],
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          byes: 0,
          timeoutLosses: 0,
          opponents: [],
        }

        commitTournament(set, touchTournament({ ...tournament, players: [...tournament.players, newPlayer] }))
        return newPlayer.id
      },

      removePlayer: (id, playerId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'setup') return

        commitTournament(set, touchTournament({
          ...tournament,
          players: tournament.players.filter(p => p.id !== playerId),
          decklists: (tournament.decklists ?? []).filter(deck => deck.playerId !== playerId),
        }))
      },

      submitDecklist: (id, playerId, deck) => {
        const tournament = get().tournaments.find(t => t.id === id)
        const player = tournament?.players.find(p => p.id === playerId)
        if (!tournament || !player || tournament.status !== 'finished') return

        const now = Date.now()
        const existing = [...(tournament.decklists ?? [])]
          .reverse()
          .find(candidate => candidate.playerId === playerId)
        const decklist: DeckList = {
          id: crypto.randomUUID(),
          playerId,
          ownerUid: player.uid ?? getCurrentUserId() ?? undefined,
          playerName: deck.playerName?.trim() || player.name,
          teamName: deck.teamName?.trim() || undefined,
          game: tournament.tcg,
          name: deck.name.trim(),
          list: deck.list.trim(),
          notes: deck.notes.trim(),
          status: 'submitted',
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }

        if (!decklist.name || !decklist.list) return

        commitTournament(set, touchTournament({
          ...tournament,
          decklists: [...(tournament.decklists ?? []), decklist].slice(-120),
        }))
      },

      publishDecklist: (id, deckId, published) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return

        commitTournament(set, touchTournament({
          ...tournament,
          decklists: (tournament.decklists ?? []).map(deck =>
            deck.id === deckId
              ? { ...deck, status: published ? 'published' : 'submitted', updatedAt: Date.now() }
              : deck
          ),
        }))
      },

      createSnapshot: (id, action, label) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        commitTournament(set, touchTournament(withSnapshot(tournament, action, label)))
      },

      restoreSnapshot: (id, snapshotId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        const snapshot = tournament?.snapshots.find(candidate => candidate.id === snapshotId)
        if (!tournament || !snapshot) return

        const restored: Tournament = {
          ...snapshot.data,
          snapshots: [
            {
              id: crypto.randomUUID(),
              action: 'restore' as TournamentSnapshotAction,
              label: `Antes de restaurar: ${snapshot.label}`,
              createdAt: Date.now(),
              data: snapshotData(tournament),
            },
            ...(tournament.snapshots ?? []),
          ].slice(0, 12),
          updatedAt: Date.now(),
        }
        commitTournament(set, restored)
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

        commitTournament(set, touchTournament({
          ...withSnapshot(tournament, 'start-tournament', 'Antes de iniciar torneo'),
          players: updatedPlayers,
          rounds: [firstRound],
          currentRound: 1,
          status: 'active',
        }))
      },

      swapCurrentRoundPlayers: (id, firstMatchId, firstPlayerId, secondMatchId, secondPlayerId) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'active') return

        const round = tournament.rounds[tournament.currentRound - 1]
        if (!round) return
        if (round.matches.some(match => match.result !== null)) return
        if (firstMatchId === secondMatchId) return
        if (firstPlayerId === secondPlayerId) return

        const firstMatch = round.matches.find(match => match.id === firstMatchId)
        const secondMatch = round.matches.find(match => match.id === secondMatchId)
        if (!firstMatch || !secondMatch) return
        if (firstMatch.p2Id === 'BYE' || secondMatch.p2Id === 'BYE') return

        const firstIsP1 = firstMatch.p1Id === firstPlayerId
        const firstIsP2 = firstMatch.p2Id === firstPlayerId
        const secondIsP1 = secondMatch.p1Id === secondPlayerId
        const secondIsP2 = secondMatch.p2Id === secondPlayerId
        if ((!firstIsP1 && !firstIsP2) || (!secondIsP1 && !secondIsP2)) return

        const updatedMatches = round.matches.map(match => {
          if (match.id === firstMatchId) {
            return {
              ...match,
              p1Id: firstIsP1 ? secondPlayerId : match.p1Id,
              p2Id: firstIsP2 ? secondPlayerId : match.p2Id,
            }
          }

          if (match.id === secondMatchId) {
            return {
              ...match,
              p1Id: secondIsP1 ? firstPlayerId : match.p1Id,
              p2Id: secondIsP2 ? firstPlayerId : match.p2Id,
            }
          }

          return match
        })

        commitTournament(set, touchTournament({
          ...withSnapshot(tournament, 'manual-pairings', `Antes de reorganizar ronda ${tournament.currentRound}`),
          pendingResults: [],
          rounds: tournament.rounds.map(candidate =>
            candidate.number === tournament.currentRound
              ? { ...candidate, matches: updatedMatches }
              : candidate
          ),
        }))
      },

      addLatePlayerToCurrentRound: (id, name) => {
        const playerName = name.trim()
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament || tournament.status !== 'active' || tournament.currentRound > 2) return 'closed'
        if (!playerName) return 'duplicate'
        if (tournament.players.some(player => player.name.toLowerCase() === playerName.toLowerCase())) return 'duplicate'

        const round = tournament.rounds[tournament.currentRound - 1]
        if (!round) return 'closed'
        if (round.matches.some(match => match.result !== null && match.result !== 'bye')) return 'has-results'

        const initialLosses = tournament.currentRound - 1
        const latePlayer: Player = {
          id: crypto.randomUUID(),
          uid: undefined,
          name: playerName,
          points: 0,
          wins: 0,
          losses: initialLosses,
          draws: 0,
          byes: 0,
          timeoutLosses: 0,
          opponents: [],
        }

        const byeMatch = round.matches.find(match => match.p2Id === 'BYE')
        if (!byeMatch) {
          commitTournament(set, touchTournament({
            ...tournament,
            players: [...tournament.players, latePlayer],
          }))
          return 'added-next-round'
        }

        const updatedPlayers = tournament.players
          .map(player => {
            if (player.id !== byeMatch.p1Id) return player
            return {
              ...player,
              points: Math.max(0, player.points - 3),
              wins: Math.max(0, player.wins - 1),
              byes: Math.max(0, player.byes - 1),
            }
          })
          .concat(latePlayer)

        const updatedRounds = tournament.rounds.map(candidate =>
          candidate.number === tournament.currentRound
            ? {
                ...candidate,
                matches: candidate.matches.map(match =>
                  match.id === byeMatch.id
                    ? { ...match, p2Id: latePlayer.id, result: null }
                    : match
                ),
              }
            : candidate
        )

        commitTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: updatedRounds,
          pendingResults: [],
        }))
        return 'added-to-round'
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

        commitTournament(set, touchTournament({
          ...tournament,
          players: updatedPlayers,
          rounds: updatedRounds,
          pendingResults,
        }))
      },

      setRoundMatchResult: (id, roundNumber, matchId, result) => {
        const tournament = get().tournaments.find(t => t.id === id)
        if (!tournament) return
        if ((tournament.tcg ?? 'magic') === 'yugioh' && result === 'draw') return

        const round = tournament.rounds.find(candidate => candidate.number === roundNumber)
        const match = round?.matches.find(candidate => candidate.id === matchId)
        if (!round || !match || match.p2Id === 'BYE') return
        if (match.result === result) return

        const updatedRounds = tournament.rounds.map(candidate =>
          candidate.number === roundNumber
            ? { ...candidate, matches: candidate.matches.map(candidateMatch => candidateMatch.id === matchId ? { ...candidateMatch, result } : candidateMatch) }
            : candidate
        )
        const pendingResults = (tournament.pendingResults ?? []).filter(p => p.matchId !== matchId)

        commitTournament(set, touchTournament({
          ...withSnapshot(tournament, 'edit-result', `Antes de corregir ronda ${roundNumber}`),
          players: rebuildPlayersFromRounds(tournament.players, updatedRounds),
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
        commitTournament(set, touchTournament({
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
        commitTournament(set, touchTournament({
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

        commitTournament(set, touchTournament({
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

        commitTournament(set, touchTournament({
          ...withSnapshot(tournament, 'next-round', `Antes de iniciar ronda ${nextRoundNumber}`),
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

        commitTournament(set, touchTournament({
          ...withSnapshot(tournament, 'finish-tournament', 'Antes de finalizar torneo'),
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
