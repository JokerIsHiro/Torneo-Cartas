import { useEffect, useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { saveRemoteLocalRanking, subscribeToRemoteLocalRanking } from '../services/firebase'
import { useExportImage } from '../hooks/useExportImage'
import type { LocalRankingSeason, LocalRankingState, LocalRankingTournamentRecord, Tournament, TournamentTCG } from '../types/tournament'

type RankingFilter = 'all' | TournamentTCG

interface RankingEntry {
  key: string
  name: string
  points: number
  wins: number
  draws: number
  losses: number
  byes: number
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

const gameLogoUrls: Partial<Record<TournamentTCG, string>> = {
  magic: '/game-logos/magic.png',
  riftbound: '/game-logos/riftbound.png',
  pokemon: '/game-logos/pokemon.png',
  yugioh: '/game-logos/yugioh.png',
  lorcana: '/game-logos/lorcana.png',
  'one-piece': '/game-logos/one-piece.png',
}

const storeLogoUrl = '/subterra-logo.jpg'

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
  const leaderboardGameLabel = gameFilter === 'all' ? 'Todos los juegos' : gameLabels[gameFilter]
  const leaderboardLogo = getLeaderboardLogo(gameFilter)
  const exportedRanking = ranking.slice(0, 16)

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
          <div style={leaderboardHeaderStyle}>
            <img src={storeLogoUrl} alt="Subterra TCG" style={storeLogoStyle} />
            <div style={seasonTitleWrapStyle}>
              <span style={leaderboardEyebrowStyle}>Top de la temporada</span>
              <h2 style={leaderboardTitleStyle}>{activeSeason.name}</h2>
              <strong style={leaderboardGameLabelStyle}>{leaderboardGameLabel}</strong>
            </div>
            <div style={gameLogoFrameStyle} aria-label={leaderboardGameLabel}>
              {leaderboardLogo.src ? (
                <img src={leaderboardLogo.src} alt={leaderboardGameLabel} style={gameLogoStyle} crossOrigin="anonymous" />
              ) : (
                <i className={leaderboardLogo.icon} aria-hidden="true" style={gameIconStyle} />
              )}
            </div>
          </div>

          <div style={headerRowStyle}>
            <span>#</span>
            <span>Jugador</span>
            <span>Puntos</span>
          </div>

          {exportedRanking.map((entry, index) => (
            <div key={entry.key} style={rowStyle(index)}>
              <span style={positionStyle}>{index + 1}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={playerNameStyle}>{entry.name}</strong>
              </div>
              <strong style={pointsStyle}>{entry.points}</strong>
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
    ['Juego', filter === 'all' ? 'Todos los juegos' : gameLabels[filter]],
    [],
    ['Posicion', 'Jugador', 'Puntos'],
    ...ranking.map((entry, index) => [
      String(index + 1),
      entry.name,
      String(entry.points),
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
    getTournamentPlayerOrder(tournament).forEach(({ player }) => {
      const key = normalizePlayerName(player.name)
      const current = entries.get(key) ?? {
        key,
        name: player.name,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        byes: 0,
        lastPlayedAt: 0,
      }

      current.name = chooseDisplayName(current.name, player.name)
      current.points += player.points
      current.wins += player.wins
      current.draws += player.draws
      current.losses += player.losses
      current.byes += player.byes
      current.lastPlayedAt = Math.max(current.lastPlayedAt, tournament.updatedAt)
      entries.set(key, current)
    })
  })

  return [...entries.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
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

function getLeaderboardLogo(filter: RankingFilter) {
  if (filter === 'all') return { icon: 'ti ti-cards' }
  if (filter === 'chess') return { icon: 'ti ti-chess' }
  return gameLogoUrls[filter] ? { src: gameLogoUrls[filter] } : { icon: 'ti ti-cards' }
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
  padding: '18px',
}

const leaderboardHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px minmax(0, 1fr) 120px',
  alignItems: 'center',
  gap: '18px',
  minHeight: '116px',
  padding: '14px 18px',
  marginBottom: '16px',
  borderRadius: 'var(--border-radius-lg)',
  background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.92), rgba(2, 6, 23, 0.96))',
  border: '0.5px solid var(--color-border-tertiary)',
}

const storeLogoStyle: React.CSSProperties = {
  width: '86px',
  height: '86px',
  objectFit: 'contain',
  justifySelf: 'center',
}

const seasonTitleWrapStyle: React.CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: '4px',
  minWidth: 0,
  textAlign: 'center',
}

const leaderboardEyebrowStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const leaderboardTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--color-text-primary)',
  fontSize: '36px',
  lineHeight: 1.1,
}

const leaderboardGameLabelStyle: React.CSSProperties = {
  color: 'var(--color-accent-secondary)',
  fontSize: '18px',
}

const gameLogoFrameStyle: React.CSSProperties = {
  width: '112px',
  height: '82px',
  display: 'grid',
  placeItems: 'center',
  justifySelf: 'center',
  overflow: 'hidden',
}

const gameLogoStyle: React.CSSProperties = {
  width: '104px',
  height: '64px',
  objectFit: 'contain',
}

const gameIconStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  border: '1px solid var(--color-border-tertiary)',
  color: 'var(--color-text-primary)',
  fontSize: '44px',
  lineHeight: 1,
}

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px minmax(180px, 1fr) 120px',
  gap: '12px',
  padding: '8px 14px',
  color: 'var(--color-text-secondary)',
  fontSize: '14px',
  fontWeight: 500,
}

function rowStyle(index: number): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '56px minmax(180px, 1fr) 120px',
    gap: '12px',
    alignItems: 'center',
    minHeight: '58px',
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: index === 0 ? '0.5px solid rgba(245, 158, 11, 0.65)' : '0.5px solid transparent',
    background: index === 0
      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(0, 122, 255, 0.1))'
      : index % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
    color: 'var(--color-text-primary)',
    fontSize: '16px',
    marginBottom: '6px',
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
  fontSize: '20px',
}

const pointsStyle: React.CSSProperties = {
  color: 'var(--color-accent-secondary)',
  fontSize: '28px',
  textAlign: 'center',
}
