import { useEffect, useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { saveRemoteLocalRanking, subscribeToRemoteLocalRanking } from '../services/firebase'
import { useExportImage } from '../hooks/useExportImage'
import type { LocalRankingSeason, LocalRankingState, LocalRankingTournamentRecord, Tournament, TournamentTCG } from '../types/tournament'

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
  const [remoteRanking, setRemoteRanking] = useState<LocalRankingState>(createDefaultRankingState())
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const { ref: rankingExportRef, exportImage } = useExportImage({ scale: 2 })
  const rankingState = useMemo(() => normalizeRankingSeasons(remoteRanking), [remoteRanking])
  const activeSeason = getActiveSeason(rankingState)
  const finishedTournaments = useMemo(
    () => tournaments.filter(tournament => tournament.status === 'finished' && tournament.updatedAt > activeSeason.resetAt),
    [activeSeason.resetAt, tournaments],
  )
  const rankingRecords = useMemo(
    () => mergeRankingRecords(activeSeason.records, finishedTournaments),
    [activeSeason.records, finishedTournaments],
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
    if (!remoteLoaded || recordsEqual(activeSeason.records, rankingRecords)) return
    void saveRemoteLocalRanking(updateActiveSeason(rankingState, { records: rankingRecords }))
  }, [activeSeason.records, rankingRecords, rankingState, remoteLoaded])

  const activeRankingRecords = useMemo(
    () => rankingRecords.filter(record => record.updatedAt > activeSeason.resetAt),
    [activeSeason.resetAt, rankingRecords],
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
          <p>{activeSeason.name} - historial basado en torneos finalizados</p>
        </div>
        <div style={actionsStyle}>
          <select
            value={rankingState.activeSeasonId}
            onChange={event => setActiveRankingSeason(rankingState, event.target.value)}
            style={filterStyle}
            aria-label="Temporada del ranking"
          >
            {rankingState.seasons?.map(season => (
              <option key={season.id} value={season.id}>{season.name}</option>
            ))}
          </select>
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
          <button type="button" style={resetButtonStyle} onClick={() => createRankingSeason(rankingState)}>
            <i className="ti ti-calendar-plus" aria-hidden="true" />
            Nueva temporada
          </button>
          <button type="button" style={resetButtonStyle} onClick={() => exportRankingCsv(ranking, activeSeason, gameFilter)}>
            <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            CSV
          </button>
          <button type="button" style={resetButtonStyle} onClick={() => void exportImage(`ranking-${activeSeason.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}>
            <i className="ti ti-photo-down" aria-hidden="true" />
            PNG
          </button>
          <button type="button" style={resetButtonStyle} onClick={() => resetRankingSeason(rankingState)}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Resetear temporada
          </button>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-chart-bar-off" aria-hidden="true" />
          <div>{activeSeason.resetAt ? 'Finaliza un torneo nuevo para alimentar esta temporada' : 'Finaliza algun torneo para alimentar el ranking local'}</div>
        </div>
      ) : (
        <div ref={rankingExportRef} style={panelStyle}>
          <div style={summaryStyle}>
            <RankingSummary label="Torneos" value={String(activeRankingRecords.length)} />
            <RankingSummary label="Jugadores" value={String(ranking.length)} />
            <RankingSummary label="Temporada" value={activeSeason.name} />
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

function createDefaultRankingState(): LocalRankingState {
  const now = Date.now()
  const season: LocalRankingSeason = {
    id: 'default',
    name: 'General',
    resetAt: 0,
    records: [],
    createdAt: now,
    updatedAt: now,
  }

  return {
    resetAt: 0,
    records: [],
    activeSeasonId: season.id,
    seasons: [season],
    updatedAt: now,
  }
}

function normalizeRankingSeasons(state: LocalRankingState): LocalRankingState {
  const legacySeason: LocalRankingSeason = {
    id: 'default',
    name: 'General',
    resetAt: state.resetAt ?? 0,
    records: state.records ?? [],
    createdAt: state.updatedAt || Date.now(),
    updatedAt: state.updatedAt || Date.now(),
  }
  const seasons = state.seasons?.length ? state.seasons : [legacySeason]
  const activeSeasonId = state.activeSeasonId && seasons.some(season => season.id === state.activeSeasonId)
    ? state.activeSeasonId
    : seasons[0].id

  return {
    ...state,
    activeSeasonId,
    seasons,
  }
}

function getActiveSeason(state: LocalRankingState): LocalRankingSeason {
  const normalized = normalizeRankingSeasons(state)
  return normalized.seasons?.find(season => season.id === normalized.activeSeasonId) ?? normalized.seasons![0]
}

function updateActiveSeason(state: LocalRankingState, patch: Partial<LocalRankingSeason>): LocalRankingState {
  const normalized = normalizeRankingSeasons(state)
  const now = Date.now()
  const seasons = normalized.seasons!.map(season =>
    season.id === normalized.activeSeasonId
      ? { ...season, ...patch, updatedAt: now }
      : season
  )
  const activeSeason = seasons.find(season => season.id === normalized.activeSeasonId) ?? seasons[0]

  return {
    resetAt: activeSeason.resetAt,
    records: activeSeason.records,
    activeSeasonId: activeSeason.id,
    seasons,
    updatedAt: now,
  }
}

function setActiveRankingSeason(state: LocalRankingState, seasonId: string) {
  const normalized = normalizeRankingSeasons(state)
  const activeSeason = normalized.seasons?.find(season => season.id === seasonId) ?? getActiveSeason(normalized)
  void saveRemoteLocalRanking({
    ...normalized,
    resetAt: activeSeason.resetAt,
    records: activeSeason.records,
    activeSeasonId: activeSeason.id,
    updatedAt: Date.now(),
  })
}

function createRankingSeason(state: LocalRankingState) {
  const name = window.prompt('Nombre de la nueva temporada', `Temporada ${new Date().toLocaleDateString('es-ES')}`)?.trim()
  if (!name) return
  const normalized = normalizeRankingSeasons(state)
  const now = Date.now()
  const seasonId = crypto.randomUUID()
  void saveRemoteLocalRanking({
    ...normalized,
    resetAt: now,
    records: [],
    activeSeasonId: seasonId,
    seasons: [
      ...(normalized.seasons ?? []),
      {
        id: seasonId,
        name,
        resetAt: now,
        records: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  })
}

function resetRankingSeason(state: LocalRankingState) {
  const activeSeason = getActiveSeason(state)
  if (!confirm(`Resetear la temporada "${activeSeason.name}"? Los torneos ya finalizados dejaran de contar para esta temporada.`)) return
  const now = Date.now()
  void saveRemoteLocalRanking(updateActiveSeason(state, {
    resetAt: now,
    records: [],
  }))
}

function exportRankingCsv(ranking: RankingEntry[], season: LocalRankingSeason, filter: RankingFilter) {
  const rows = [
    ['Temporada', season.name],
    ['Filtro', filter === 'all' ? 'Todos' : gameLabels[filter]],
    [],
    ['Posicion', 'Jugador', 'Score', 'Torneos', 'Puntos', 'Victorias', 'Empates', 'Derrotas', 'Top 1', 'Top 4', 'Juegos'],
    ...ranking.map((entry, index) => [
      String(index + 1),
      entry.name,
      String(entry.localScore),
      String(entry.tournaments),
      String(entry.points),
      String(entry.wins),
      String(entry.draws),
      String(entry.losses),
      String(entry.firstPlaces),
      String(entry.topFour),
      [...entry.games].map(game => gameLabels[game]).join(' / '),
    ]),
  ]
  const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `ranking-${season.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

function escapeCsvCell(value: string | undefined) {
  const cell = value ?? ''
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
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
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
