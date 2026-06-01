import { useEffect, useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { saveRemoteLocalRanking, subscribeToRemoteLocalRanking } from '../services/firebase'
import type { LocalRankingState, LocalRankingTournamentRecord, Tournament, TournamentTCG } from '../types/tournament'

type RankingFilter = 'all' | TournamentTCG

interface RankingEntry {
  key: string
  name: string
  games: Set<TournamentTCG>
  tournaments: number
  points: number
  localScore: number
  wins: number
  draws: number
  losses: number
  byes: number
  firstPlaces: number
  topFour: number
  lastPlayedAt: number
}

const gameLabels: Record<TournamentTCG, string> = {
  magic: 'Magic',
  riftbound: 'Riftbound',
  pokemon: 'Pokemon',
  yugioh: 'YuGiOh',
  lorcana: 'Lorcana',
  'one-piece': 'One Piece',
  chess: 'Ajedrez',
}

export function LocalRanking() {
  const tournaments = useTournamentsStore(s => s.tournaments)
  const [gameFilter, setGameFilter] = useState<RankingFilter>('all')
  const [remoteRanking, setRemoteRanking] = useState<LocalRankingState>({ resetAt: 0, records: [], updatedAt: 0 })
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const finishedTournaments = useMemo(
    () => tournaments.filter(tournament => tournament.status === 'finished' && tournament.updatedAt > remoteRanking.resetAt),
    [remoteRanking.resetAt, tournaments],
  )
  const rankingRecords = useMemo(
    () => mergeRankingRecords(remoteRanking.records, finishedTournaments),
    [finishedTournaments, remoteRanking.records],
  )

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let isMounted = true

    void subscribeToRemoteLocalRanking(
      ranking => {
        if (!isMounted) return
        setRemoteRanking(ranking)
        setRemoteLoaded(true)
      },
      error => {
        console.error('No se ha podido escuchar el ranking local', error)
        setRemoteLoaded(true)
      },
    ).then(nextUnsubscribe => {
      unsubscribe = nextUnsubscribe
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!remoteLoaded || recordsEqual(remoteRanking.records, rankingRecords)) return
    void saveRemoteLocalRanking({
      resetAt: remoteRanking.resetAt,
      records: rankingRecords,
      updatedAt: Date.now(),
    })
  }, [rankingRecords, remoteLoaded, remoteRanking.records, remoteRanking.resetAt])

  const activeRankingRecords = useMemo(
    () => rankingRecords.filter(record => record.updatedAt > remoteRanking.resetAt),
    [rankingRecords, remoteRanking.resetAt],
  )
  const ranking = useMemo(
    () => buildLocalRanking(activeRankingRecords, gameFilter),
    [activeRankingRecords, gameFilter],
  )
  const availableGames = useMemo(() => {
    return [...new Set(activeRankingRecords.map(tournament => tournament.tcg))]
      .sort((a, b) => gameLabels[a].localeCompare(gameLabels[b]))
  }, [activeRankingRecords])

  return (
    <section>
      <div className="tournament-header">
        <div>
          <h2>Ranking local</h2>
          <p>Historial de jugadores basado en torneos finalizados</p>
        </div>
        <div style={actionsStyle}>
          <select
            value={gameFilter}
            onChange={event => setGameFilter(event.target.value as RankingFilter)}
            style={filterStyle}
            aria-label="Filtrar ranking por juego"
          >
            <option value="all">Todos los juegos</option>
            {availableGames.map(game => (
              <option key={game} value={game}>{gameLabels[game]}</option>
            ))}
          </select>
          <button type="button" style={resetButtonStyle} onClick={() => resetRanking()}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Resetear ranking
          </button>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-chart-bar-off" aria-hidden="true" />
          <div>{remoteRanking.resetAt ? 'Finaliza un torneo nuevo para alimentar el ranking local' : 'Finaliza algun torneo para alimentar el ranking local'}</div>
        </div>
      ) : (
        <div style={panelStyle}>
          <div style={summaryStyle}>
            <RankingSummary label="Torneos" value={String(activeRankingRecords.length)} />
            <RankingSummary label="Jugadores" value={String(ranking.length)} />
            <RankingSummary label="Filtro" value={gameFilter === 'all' ? 'Todos' : gameLabels[gameFilter]} />
          </div>

          <div style={headerRowStyle}>
            <span>#</span>
            <span>Jugador</span>
            <span>Score</span>
            <span>Torneos</span>
            <span>V/E/D</span>
            <span>Top 1</span>
            <span>Top 4</span>
          </div>

          {ranking.map((entry, index) => (
            <div key={entry.key} style={rowStyle(index)}>
              <span style={positionStyle}>{index + 1}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={playerNameStyle}>{entry.name}</strong>
                <span style={gamesStyle}>{[...entry.games].map(game => gameLabels[game]).join(' · ')}</span>
              </div>
              <strong style={scoreStyle}>{entry.localScore}</strong>
              <span>{entry.tournaments}</span>
              <span>{entry.wins}/{entry.draws}/{entry.losses}</span>
              <span>{entry.firstPlaces}</span>
              <span>{entry.topFour}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function tournamentToRankingRecord(tournament: Tournament): LocalRankingTournamentRecord {
  return {
    id: tournament.id,
    name: tournament.name,
    tcg: tournament.tcg,
    players: tournament.players,
    updatedAt: tournament.updatedAt,
  }
}

function mergeRankingRecords(records: LocalRankingTournamentRecord[], tournaments: Tournament[]) {
  const byId = new Map(records.map(record => [record.id, record]))

  for (const tournament of tournaments) {
    const currentRecord = byId.get(tournament.id)
    if (currentRecord && currentRecord.updatedAt >= tournament.updatedAt) continue
    byId.set(tournament.id, tournamentToRankingRecord(tournament))
  }

  return [...byId.values()].sort((a, b) => a.updatedAt - b.updatedAt)
}

function recordsEqual(a: LocalRankingTournamentRecord[], b: LocalRankingTournamentRecord[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function resetRanking() {
  if (!confirm('Resetear el ranking local? Los torneos ya finalizados dejaran de contar para el ranking.')) return
  const now = Date.now()
  void saveRemoteLocalRanking({
    resetAt: now,
    records: [],
    updatedAt: now,
  })
}

function buildLocalRanking(tournaments: LocalRankingTournamentRecord[], filter: RankingFilter) {
  const entries = new Map<string, RankingEntry>()
  const filtered = tournaments.filter(tournament => filter === 'all' || tournament.tcg === filter)

  filtered.forEach(tournament => {
    getTournamentPlayerOrder(tournament).forEach(({ player, position }) => {
      const key = normalizePlayerName(player.name)
      const current = entries.get(key) ?? {
        key,
        name: player.name,
        games: new Set<TournamentTCG>(),
        tournaments: 0,
        points: 0,
        localScore: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        byes: 0,
        firstPlaces: 0,
        topFour: 0,
        lastPlayedAt: 0,
      }

      current.name = chooseDisplayName(current.name, player.name)
      current.games.add(tournament.tcg)
      current.tournaments += 1
      current.points += player.points
      current.wins += player.wins
      current.draws += player.draws
      current.losses += player.losses
      current.byes += player.byes
      current.firstPlaces += position === 1 ? 1 : 0
      current.topFour += position <= 4 ? 1 : 0
      current.lastPlayedAt = Math.max(current.lastPlayedAt, tournament.updatedAt)
      current.localScore += player.points + 2 + getPlacementBonus(position)
      entries.set(key, current)
    })
  })

  return [...entries.values()].sort((a, b) => {
    if (b.localScore !== a.localScore) return b.localScore - a.localScore
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces
    if (b.topFour !== a.topFour) return b.topFour - a.topFour
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.lastPlayedAt - a.lastPlayedAt
  })
}

function getTournamentPlayerOrder(tournament: LocalRankingTournamentRecord) {
  return tournament.players
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return a.name.localeCompare(b.name)
    })
    .map((player, index) => ({ player, position: index + 1 }))
}

function normalizePlayerName(name: string) {
  return name.trim().toLocaleLowerCase('es-ES').replace(/\s+/g, ' ')
}

function chooseDisplayName(current: string, next: string) {
  return next.length > current.length ? next : current
}

function getPlacementBonus(position: number) {
  if (position === 1) return 8
  if (position === 2) return 5
  if (position === 3) return 3
  if (position === 4) return 2
  return 0
}

function RankingSummary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const filterStyle: React.CSSProperties = {
  width: '220px',
  padding: '9px 10px',
  borderRadius: 'var(--border-radius-md)',
  border: '0.5px solid var(--color-border-tertiary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
}

const resetButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 10px',
  borderRadius: 'var(--border-radius-md)',
  border: '0.5px solid var(--color-border-tertiary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '12px',
}

const summaryStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  marginBottom: '12px',
}

const summaryCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--color-background-secondary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  padding: '10px 12px',
  color: 'var(--color-text-secondary)',
  fontSize: '12px',
}

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(180px, 1fr) 70px 70px 90px 60px 60px',
  gap: '8px',
  padding: '8px 10px',
  color: 'var(--color-text-secondary)',
  fontSize: '11px',
  fontWeight: 500,
}

function rowStyle(index: number): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '34px minmax(180px, 1fr) 70px 70px 90px 60px 60px',
    gap: '8px',
    alignItems: 'center',
    padding: '9px 10px',
    borderRadius: 'var(--border-radius-md)',
    background: index % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
  }
}

const positionStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
}

const playerNameStyle: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const gamesStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--color-text-secondary)',
  fontSize: '11px',
}

const scoreStyle: React.CSSProperties = {
  color: 'var(--color-accent-secondary)',
}
