// Tipos centrales del dominio: jugadores, partidas, rondas y torneos.
// Si se anade una nueva estadistica o un nuevo juego, normalmente empieza aqui.
export interface Player {
  id: string
  uid?: string
  name: string
  points: number
  wins: number
  losses: number
  draws: number
  byes: number
  timeoutLosses: number
  opponents: string[]
}

export interface DeckList {
  id: string
  playerId: string
  ownerUid?: string
  playerName: string
  game: TournamentTCG
  name: string
  list: string
  notes: string
  status: 'draft' | 'submitted' | 'published'
  createdAt: number
  updatedAt: number
}

export type MatchResult = 'p1' | 'p2' | 'draw' | 'timeout' | 'bye' | null

export interface Match {
  id: string
  tableNumber: number
  p1Id: string
  p2Id: string | 'BYE'
  result: MatchResult
}

export interface PendingMatchResult {
  id: string
  submittedByUid?: string
  roundNumber: number
  matchId: string
  playerId: string
  result: Exclude<MatchResult, 'bye' | null>
  createdAt: number
}

export interface Round {
  number: number
  matches: Match[]
  startedAt: number | null
  endedAt: number | null
}

export type TournamentStatus = 'setup' | 'active' | 'finished'
export type TournamentTCG = 'magic' | 'riftbound' | 'pokemon' | 'yugioh' | 'lorcana' | 'one-piece'

export type TournamentSnapshotAction =
  | 'start-tournament'
  | 'next-round'
  | 'finish-tournament'
  | 'delete-tournament'
  | 'manual-pairings'
  | 'edit-result'
  | 'restore'

export type TournamentSnapshotData = Omit<Tournament, 'snapshots'>

export interface TournamentSnapshot {
  id: string
  action: TournamentSnapshotAction
  label: string
  createdAt: number
  data: TournamentSnapshotData
}

export interface Tournament {
  id: string
  organizerUid?: string
  name: string
  tcg: TournamentTCG
  players: Player[]
  rounds: Round[]
  pendingResults: PendingMatchResult[]
  decklists: DeckList[]
  snapshots: TournamentSnapshot[]
  currentRound: number
  status: TournamentStatus
  timerDuration: number  // segundos
  createdAt: number
  updatedAt: number
}
