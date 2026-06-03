import { useState } from 'react'
import { useTournamentsStore } from './store/tournamentsStore'
import { useSwissPairings } from './hooks/useSwissPairings'
import { useExportImage } from './hooks/useExportImage'
import { RoundExport } from './components/RoundExport'
import type { Match, MatchResult, Tournament } from './types/tournament'

type AppTab = 'setup' | 'round' | 'standings'

export default function App() {
  const tournaments = useTournamentsStore(state => state.tournaments)
  const createTournament = useTournamentsStore(state => state.createTournament)
  const deleteTournament = useTournamentsStore(state => state.deleteTournament)
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => tournaments.at(-1)?.id ?? '')
  const [tab, setTab] = useState<AppTab>('setup')

  const selectedTournament = tournaments.find(tournament => tournament.id === selectedTournamentId) ?? tournaments.at(-1) ?? null

  function handleCreateTournament() {
    const id = createTournament()
    setSelectedTournamentId(id)
    setTab('setup')
  }

  return (
    <main className="aether-app">
      <header className="aether-hero">
        <div>
          <span>AetherHub</span>
          <h1>Gestor YuGiOh</h1>
          <p>Torneos rapidos, emparejamientos y standing para movil.</p>
        </div>
        <button onClick={handleCreateTournament} aria-label="Crear torneo">
          <i className="ti ti-plus" aria-hidden="true" />
        </button>
      </header>

      {tournaments.length > 1 && (
        <div className="aether-tournament-strip" aria-label="Torneos">
          {tournaments.map(tournament => (
            <button
              key={tournament.id}
              className={selectedTournament?.id === tournament.id ? 'active' : ''}
              onClick={() => {
                setSelectedTournamentId(tournament.id)
                setTab(tournament.status === 'setup' ? 'setup' : 'round')
              }}
            >
              {tournament.name}
            </button>
          ))}
        </div>
      )}

      {!selectedTournament ? (
        <EmptyHome onCreate={handleCreateTournament} />
      ) : (
        <>
          <TournamentHeader
            tournament={selectedTournament}
            activeTab={tab}
            onTabChange={setTab}
            onDelete={() => {
              if (!confirm(`Eliminar "${selectedTournament.name}"?`)) return
              deleteTournament(selectedTournament.id)
              const next = tournaments.find(tournament => tournament.id !== selectedTournament.id)
              setSelectedTournamentId(next?.id ?? '')
              setTab('setup')
            }}
          />

          <section className="aether-panel-shell">
            {tab === 'setup' && <SetupPanel tournament={selectedTournament} onGoRound={() => setTab('round')} />}
            {tab === 'round' && <RoundPanel tournament={selectedTournament} />}
            {tab === 'standings' && <StandingsPanel tournament={selectedTournament} />}
          </section>

          <nav className="aether-bottom-nav" aria-label="Navegacion principal">
            <button className={tab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}>
              <i className="ti ti-users" aria-hidden="true" />
              Jugadores
            </button>
            <button className={tab === 'round' ? 'active' : ''} onClick={() => setTab('round')}>
              <i className="ti ti-swords" aria-hidden="true" />
              Ronda
            </button>
            <button className={tab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>
              <i className="ti ti-trophy" aria-hidden="true" />
              Standing
            </button>
          </nav>
        </>
      )}
    </main>
  )
}

function EmptyHome({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="aether-home">
      <div className="aether-home-card">
        <div className="aether-brand-mark">
          <i className="ti ti-cards" aria-hidden="true" />
        </div>
        <span>YuGiOh Swiss Tool</span>
        <h2>Prepara el torneo en segundos</h2>
        <p>Inscribes jugadores, generas rondas, marcas resultados y compartes emparejamientos o clasificacion como imagen.</p>
        <button onClick={onCreate}>
          <i className="ti ti-plus" aria-hidden="true" />
          Crear torneo
        </button>
      </div>

      <div className="aether-home-grid" aria-label="Funciones principales">
        <div>
          <i className="ti ti-users" aria-hidden="true" />
          <strong>Jugadores</strong>
          <span>Alta rapida</span>
        </div>
        <div>
          <i className="ti ti-swords" aria-hidden="true" />
          <strong>Rondas</strong>
          <span>Suizo automatico</span>
        </div>
        <div>
          <i className="ti ti-photo-share" aria-hidden="true" />
          <strong>Imagenes</strong>
          <span>Listas para compartir</span>
        </div>
      </div>
    </section>
  )
}

function TournamentHeader({
  tournament,
  activeTab,
  onTabChange,
  onDelete,
}: {
  tournament: Tournament
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onDelete: () => void
}) {
  const { totalRounds, roundSummaries } = useSwissPairings(tournament.id)
  const playedRounds = roundSummaries.filter(round => round.matchesTotal > 0).length

  return (
    <section className="aether-tournament-card" aria-label="Resumen del torneo">
      <div className="aether-tournament-main">
        <span>{statusLabel(tournament.status)}</span>
        <h2>{tournament.name}</h2>
        <p>{tournament.players.length} jugadores - {playedRounds || tournament.currentRound || 0}/{totalRounds || '-'} rondas</p>
      </div>

      <div className="aether-flow-tabs" aria-label="Flujo del torneo">
        <button className={activeTab === 'setup' ? 'active' : ''} onClick={() => onTabChange('setup')}>
          <i className="ti ti-users" aria-hidden="true" />
          <span>Jugadores</span>
        </button>
        <button className={activeTab === 'round' ? 'active' : ''} onClick={() => onTabChange('round')}>
          <i className="ti ti-swords" aria-hidden="true" />
          <span>Ronda</span>
        </button>
        <button className={activeTab === 'standings' ? 'active' : ''} onClick={() => onTabChange('standings')}>
          <i className="ti ti-trophy" aria-hidden="true" />
          <span>Standing</span>
        </button>
      </div>

      <button className="aether-icon-danger" onClick={onDelete} aria-label="Eliminar torneo">
        <i className="ti ti-trash" aria-hidden="true" />
      </button>
    </section>
  )
}

function SetupPanel({ tournament, onGoRound }: { tournament: Tournament; onGoRound: () => void }) {
  const updateTournamentName = useTournamentsStore(state => state.updateTournamentName)
  const addPlayer = useTournamentsStore(state => state.addPlayer)
  const removePlayer = useTournamentsStore(state => state.removePlayer)
  const startTournament = useTournamentsStore(state => state.startTournament)
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const { totalRounds } = useSwissPairings(tournament.id)

  function handleAddPlayer() {
    const nextName = playerName.trim()
    setError('')
    if (!nextName) return
    const result = addPlayer(tournament.id, nextName)
    if (!result) {
      setError('Ese jugador ya existe.')
      return
    }
    setPlayerName('')
  }

  function handleStart() {
    if (tournament.players.length < 2) {
      setError('Necesitas al menos 2 jugadores.')
      return
    }
    startTournament(tournament.id)
    onGoRound()
  }

  return (
    <div className="aether-stack">
      <div className="aether-setup-top">
        <div className="aether-panel-title">
          <span>Configuracion rapida</span>
          <h2>Nuevo torneo</h2>
          <p>YuGiOh, formato suizo y resultados por partida.</p>
        </div>
        <div className="aether-kpi-grid">
          <Kpi label="Jugadores" value={tournament.players.length} />
          <Kpi label="Rondas" value={tournament.players.length >= 2 ? totalRounds : '-'} />
          <Kpi label="Juego" value="YuGiOh" />
        </div>
      </div>

      <section className="aether-config-card">
        <label className="aether-field">
          <span>Nombre del torneo</span>
          <input
            value={tournament.name}
            onChange={event => updateTournamentName(tournament.id, event.target.value)}
            placeholder="Torneo YuGiOh"
          />
        </label>
        <div className="aether-fixed-options" aria-label="Opciones fijas">
          <div>
            <span>Juego</span>
            <strong>YuGiOh</strong>
          </div>
          <div>
            <span>Modalidad</span>
            <strong>Normal</strong>
          </div>
          <div>
            <span>Estructura</span>
            <strong>Suizo</strong>
          </div>
        </div>
      </section>

      <section className="aether-config-card">
        <div className="aether-section-title compact-title">
          <div>
            <span>Añadir jugadores</span>
            <h2>Inscritos</h2>
          </div>
          <strong>{tournament.players.length}</strong>
        </div>

        {tournament.status === 'setup' && (
          <div className="aether-add-player">
            <input
              value={playerName}
              onChange={event => {
                setPlayerName(event.target.value)
                setError('')
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') handleAddPlayer()
              }}
              placeholder="Nombre del jugador"
            />
            <button onClick={handleAddPlayer} disabled={!playerName.trim()} aria-label="Añadir jugador">
              <i className="ti ti-user-plus" aria-hidden="true" />
            </button>
          </div>
        )}

        {error && <div className="aether-error">{error}</div>}

        <div className="aether-list">
          {tournament.players.length === 0 ? (
            <div className="aether-list-empty">Añade al menos 2 jugadores para empezar.</div>
          ) : tournament.players.map((player, index) => (
            <div key={player.id} className="aether-player-row">
              <span>{index + 1}</span>
              <strong>{player.name}</strong>
              {tournament.status === 'setup' && (
                <button onClick={() => removePlayer(tournament.id, player.id)} aria-label={`Quitar ${player.name}`}>
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {tournament.status === 'setup' ? (
        <button className="aether-primary" onClick={handleStart} disabled={tournament.players.length < 2}>
          Comenzar ronda 1
        </button>
      ) : (
        <div className="aether-note">El torneo ya esta iniciado. Los jugadores se gestionan desde resultados.</div>
      )}
    </div>
  )
}

function RoundPanel({ tournament }: { tournament: Tournament }) {
  const setMatchResult = useTournamentsStore(state => state.setMatchResult)
  const nextRound = useTournamentsStore(state => state.nextRound)
  const finishTournament = useTournamentsStore(state => state.finishTournament)
  const {
    currentMatches,
    currentRound,
    allResultsIn,
    shouldFinish,
    totalRounds,
    getPlayerName,
  } = useRoundData(tournament.id)
  const { ref: roundExportRef, shareImage: shareRoundImage, exportImage: exportRoundImage } = useExportImage({ scale: 3 })

  if (tournament.status === 'setup') {
    return (
      <div className="aether-empty compact">
        <i className="ti ti-swords" aria-hidden="true" />
        <h2>Sin ronda activa</h2>
        <p>Comienza el torneo desde Jugadores para generar los primeros emparejamientos.</p>
      </div>
    )
  }

  return (
    <div className="aether-stack">
      <RoundStatusCard
        currentRound={currentRound}
        totalRounds={totalRounds}
        allResultsIn={allResultsIn}
        onShare={() => shareRoundImage(`aetherhub-ronda-${currentRound}`)}
        onDownload={() => exportRoundImage(`aetherhub-ronda-${currentRound}`)}
      />

      <div className="aether-section-title">
        <div>
          <span>Emparejamientos</span>
          <h2>Ronda {currentRound}</h2>
        </div>
        <button onClick={() => void shareRoundImage(`aetherhub-ronda-${currentRound}`)} aria-label="Compartir imagen de ronda">
          <i className="ti ti-share-3" aria-hidden="true" />
        </button>
      </div>

      <div className="aether-export-stage" aria-hidden="true">
        <RoundExport ref={roundExportRef} tournamentId={tournament.id} type="round" />
      </div>

      <div className="aether-match-list">
        {currentMatches.map(match => (
          <MatchRow
            key={match.id}
            match={match}
            getPlayerName={getPlayerName}
            onResult={result => setMatchResult(tournament.id, match.id, result)}
          />
        ))}
      </div>

      {tournament.status === 'active' && (
        <button
          className="aether-primary"
          disabled={!allResultsIn}
          onClick={() => shouldFinish ? finishTournament(tournament.id) : nextRound(tournament.id)}
        >
          {shouldFinish ? 'Finalizar torneo' : 'Generar siguiente ronda'}
        </button>
      )}

      {tournament.status === 'finished' && (
        <div className="aether-note">Torneo finalizado. Puedes compartir el standing final.</div>
      )}
    </div>
  )
}

function RoundStatusCard({
  currentRound,
  totalRounds,
  allResultsIn,
  onShare,
  onDownload,
}: {
  currentRound: number
  totalRounds: number
  allResultsIn: boolean
  onShare: () => void
  onDownload: () => void
}) {
  return (
    <section className="aether-round-status">
      <div>
        <span>Ronda actual</span>
        <h2>Ronda {currentRound} de {totalRounds}</h2>
        <p>{allResultsIn ? 'Todos los resultados estan registrados.' : 'Registra resultados y comparte emparejamientos en PNG.'}</p>
      </div>
      <div className="aether-share-actions">
        <button onClick={onShare}>
          <i className="ti ti-share-3" aria-hidden="true" />
          Compartir
        </button>
        <button onClick={onDownload} aria-label="Descargar imagen">
          <i className="ti ti-download" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function MatchRow({
  match,
  getPlayerName,
  onResult,
}: {
  match: Match
  getPlayerName: (id: string) => string
  onResult: (result: MatchResult) => void
}) {
  const p1Name = getPlayerName(match.p1Id)
  const p2Name = getPlayerName(match.p2Id)

  return (
    <article className="aether-match-card">
      <header>
        <span>Mesa {match.tableNumber}</span>
        <strong>{resultLabel(match.result, p1Name, p2Name)}</strong>
      </header>
      <div className="aether-versus">
        <strong>{p1Name}</strong>
        <span>vs</span>
        <strong>{p2Name}</strong>
      </div>
      {match.p2Id !== 'BYE' && (
        <div className="aether-result-buttons">
          <button className={match.result === 'p1' ? 'active' : ''} onClick={() => onResult('p1')}>Gana 1</button>
          <button className={match.result === 'p2' ? 'active' : ''} onClick={() => onResult('p2')}>Gana 2</button>
          <button className={match.result === 'timeout' ? 'active danger' : ''} onClick={() => onResult('timeout')}>Doble loss</button>
        </div>
      )}
    </article>
  )
}

function StandingsPanel({ tournament }: { tournament: Tournament }) {
  const { standings, primaryTiebreakerMetric, tiebreakerLabel } = useSwissPairings(tournament.id)
  const { ref: standingsExportRef, shareImage: shareStandingsImage, exportImage: exportStandingsImage } = useExportImage({ scale: 3 })
  const metricLabel = primaryTiebreakerMetric ? primaryTiebreakerMetric.toUpperCase() : tiebreakerLabel

  return (
    <div className="aether-stack">
      <div className="aether-round-status standings-hero">
        <div>
          <span>{tournament.status === 'finished' ? 'Final' : 'En curso'}</span>
          <h2>Clasificacion</h2>
          <p>{standings.length} jugadores ordenados por puntos y desempates.</p>
        </div>
        <div className="aether-share-actions">
          <button onClick={() => void shareStandingsImage('aetherhub-clasificacion')}>
            <i className="ti ti-share-3" aria-hidden="true" />
            Compartir
          </button>
          <button onClick={() => void exportStandingsImage('aetherhub-clasificacion')} aria-label="Descargar imagen">
            <i className="ti ti-download" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="aether-export-stage" aria-hidden="true">
        <RoundExport ref={standingsExportRef} tournamentId={tournament.id} type="standings" />
      </div>

      <div className="aether-standing-list">
        <div className="aether-standing-header">
          <span>#</span>
          <span>Jugador</span>
          <span>Pts</span>
          <span>V-D</span>
          <span>{metricLabel}</span>
        </div>
        {standings.map(row => (
          <div key={row.player.id} className="aether-standing-row">
            <span>{row.position}</span>
            <strong>{row.player.name}</strong>
            <span>{row.player.points}</span>
            <span>{row.player.wins}-{row.player.losses}</span>
            <span>{row.player.byes ? `${row.player.byes} bye` : '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="aether-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function useRoundData(tournamentId: string) {
  const tournament = useTournamentsStore(state => state.tournaments.find(candidate => candidate.id === tournamentId))
  const swiss = useSwissPairings(tournamentId)
  return {
    ...swiss,
    currentRound: tournament?.currentRound ?? 0,
  }
}

function statusLabel(status: Tournament['status']) {
  if (status === 'setup') return 'Preparacion'
  if (status === 'active') return 'En curso'
  return 'Finalizado'
}

function resultLabel(result: MatchResult, p1Name: string, p2Name: string) {
  if (result === 'bye') return 'BYE'
  if (result === 'p1') return `Gana ${p1Name}`
  if (result === 'p2') return `Gana ${p2Name}`
  if (result === 'timeout') return 'Doble loss'
  return 'Pendiente'
}
