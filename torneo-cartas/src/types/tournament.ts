export interface Player {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  timeoutLosses: number;  // ← nuevo: derrotas por tiempo
  opponents: string[];
}

// 'timeout' = ambos pierden por tiempo agotado
export type MatchResult = 'p1' | 'p2' | 'draw' | 'timeout' | 'bye' | null;

export interface Match {
  id: string;
  tableNumber: number;
  p1Id: string;
  p2Id: string | 'BYE';
  result: MatchResult;
}

export interface Round {
  number: number;
  matches: Match[];
  startedAt: number | null;
  endedAt: number | null;
}

export interface TournamentState {
  name: string;
  players: Player[];
  rounds: Round[];
  currentRound: number;
  status: 'setup' | 'active' | 'finished';
  timerDuration: number;
}