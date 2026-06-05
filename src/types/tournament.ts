// Tipos centrales del dominio: jugadores, partidas, rondas y torneos.
// Si se anade una nueva estadistica o un nuevo juego, normalmente empieza aqui.
export interface Player {
  id: string
  uid?: string
  name: string
  teamMembers?: string[]
  captainName?: string
  playerKind?: 'regular' | 'new'
  droppedAt?: number | null
  droppedRound?: number | null
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
  teamName?: string
  game: TournamentTCG
  archetype?: string
  name: string
  list: string
  notes: string
  status: 'draft' | 'submitted' | 'published'
  createdAt: number
  updatedAt: number
}

export type MatchResult = 'p1' | 'p2' | 'p3' | 'p4' | 'draw' | 'timeout' | 'bye' | null

export interface Match {
  id: string
  tableNumber: number
  p1Id: string
  p2Id: string | 'BYE'
  playerIds?: string[]
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

// Tipos centrales del dominio. Si anades campos a torneos, jugadores o rondas,
// actualiza tambien normalizadores de Firebase y migraciones implicitas.
export type TournamentStatus = 'setup' | 'active' | 'finished'
export type TournamentTCG = 'magic' | 'riftbound' | 'pokemon' | 'yugioh' | 'lorcana' | 'one-piece' | 'chess'
export type MagicFormat = 'standard' | 'pioneer' | 'modern' | 'pauper' | 'commander' | 'legacy' | 'vintage'
export type TournamentTeamMode = 'solo' | '2v2' | '3v3'
export type TournamentPhaseMode = 'swiss' | 'swiss-top'
export type TournamentTiebreakerSystem =
  | 'tcg-resistance'
  | 'magic-match'
  | 'pokemon-official'
  | 'fide-buchholz'
  | 'fide-buchholz-cut-1'
  | 'fide-buchholz-median-1'
  | 'fide-sonneborn-berger'
  | 'fide-progressive'
  | 'direct-encounter'
  | 'wins'
  | 'fewest-losses'
  | 'fewest-timeout-losses'
  | 'none'

export type TournamentSnapshotAction =
  | 'start-tournament'
  | 'next-round'
  | 'finish-tournament'
  | 'delete-tournament'
  | 'manual-pairings'
  | 'edit-result'
  | 'drop-player'
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
  magicFormat?: MagicFormat
  teamMode: TournamentTeamMode
  phaseMode: TournamentPhaseMode
  topCut: number
  players: Player[]
  rounds: Round[]
  pendingResults: PendingMatchResult[]
  decklists: DeckList[]
  snapshots: TournamentSnapshot[]
  currentRound: number
  status: TournamentStatus
  timerDuration: number  // segundos
  manualRoundCount?: number | null
  tiebreakerSystem: TournamentTiebreakerSystem
  createdAt: number
  updatedAt: number
}

export interface LocalRankingTournamentRecord {
  id: string
  name: string
  tcg: TournamentTCG
  players: Player[]
  updatedAt: number
}

export interface LocalRankingSeason {
  id: string
  name: string
  resetAt: number
  records: LocalRankingTournamentRecord[]
  createdAt: number
  updatedAt: number
}

export interface LocalRankingState {
  resetAt: number
  records: LocalRankingTournamentRecord[]
  activeSeasonId?: string
  seasons?: LocalRankingSeason[]
  updatedAt: number
}

export interface KnownPlayer {
  id: string
  name: string
  games: TournamentTCG[]
  kind: Player['playerKind']
  updatedAt: number
}

export interface KnownPlayersState {
  players: KnownPlayer[]
  updatedAt: number
}
