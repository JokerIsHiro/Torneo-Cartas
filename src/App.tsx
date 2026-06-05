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
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [tab, setTab] = useState<AppTab>('setup')

  const selectedTournament = tournaments.find(tournament => tournament.id === selectedTournamentId) ?? null
  const canShowStandings = selectedTournament?.status === 'finished'
  const visibleTab: AppTab = tab === 'standings' && !canShowStandings
    ? selectedTournament?.status === 'setup' ? 'setup' : 'round'
    : tab

  function handleCreateTournament() {
    const id = createTournament()
    setSelectedTournamentId(id)
    setTab('setup')
  }

  return (
    <main className={`aether-app ${selectedTournament ? 'has-tournament' : ''}`}>
      {(selectedTournament || tournaments.length > 0) && (
        <header className={`aether-hero ${!selectedTournament ? 'is-home' : ''}`}>
          <button
            className="aether-ghost-action"
            onClick={() => {
              setSelectedTournamentId('')
              setTab('setup')
            }}
            aria-label="Volver a torneos"
          >
            <i className="ti ti-layout-list" aria-hidden="true" />
          </button>
          <div>
            <span>AetherHub</span>
            <h1>{selectedTournament ? selectedTournament.name : 'Torneos'}</h1>
          </div>
          <button onClick={handleCreateTournament} aria-label="Crear torneo">
            <i className="ti ti-plus" aria-hidden="true" />
          </button>
        </header>
      )}

      {selectedTournament && tournaments.length > 1 && (
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
        tournaments.length === 0 ? (
          <EmptyHome onCreate={handleCreateTournament} />
        ) : (
          <TournamentLobby
            tournaments={tournaments}
            onCreate={handleCreateTournament}
            onOpen={tournament => {
              setSelectedTournamentId(tournament.id)
              setTab(tournament.status === 'setup' ? 'setup' : 'round')
            }}
          />
        )
      ) : (
        <>
          {visibleTab !== 'setup' && (
            <TournamentHeader
              tournament={selectedTournament}
              onDelete={() => {
                if (!confirm(`Eliminar "${selectedTournament.name}"?`)) return
                deleteTournament(selectedTournament.id)
                setSelectedTournamentId('')
                setTab('setup')
              }}
            />
          )}

          <section className="aether-panel-shell">
            {visibleTab === 'setup' && (
              <SetupPanel
                tournament={selectedTournament}
                onGoRound={() => setTab('round')}
                onDelete={() => {
                  if (!confirm(`Eliminar "${selectedTournament.name}"?`)) return
                  deleteTournament(selectedTournament.id)
                  setSelectedTournamentId('')
                  setTab('setup')
                }}
              />
            )}
            {visibleTab === 'round' && <RoundPanel tournament={selectedTournament} onFinished={() => setTab('standings')} />}
            {visibleTab === 'standings' && canShowStandings && <StandingsPanel tournament={selectedTournament} />}
          </section>

          <nav className="aether-bottom-nav" aria-label="Navegacion principal">
            <button className={visibleTab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}>
              <i className="ti ti-users" aria-hidden="true" />
              Jugadores
            </button>
            <button className={visibleTab === 'round' ? 'active' : ''} onClick={() => setTab('round')}>
              <i className="ti ti-swords" aria-hidden="true" />
              Ronda
            </button>
            {canShowStandings && (
              <button className={visibleTab === 'standings' ? 'active' : ''} onClick={() => setTab('standings')}>
                <i className="ti ti-trophy" aria-hidden="true" />
                Standing
              </button>
            )}
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
        <button onClick={onCreate}>
          <i className="ti ti-plus" aria-hidden="true" />
          Crear torneo
        </button>
      </div>
    </section>
  )
}

function TournamentLobby({
  tournaments,
  onCreate,
  onOpen,
}: {
  tournaments: Tournament[]
  onCreate: () => void
  onOpen: (tournament: Tournament) => void
}) {
  return (
    <section className="aether-lobby" aria-label="Torneos disponibles">
      <div className="aether-lobby-list">
        {tournaments.map(tournament => (
          <TournamentLobbyCard
            key={tournament.id}
            tournament={tournament}
            onOpen={() => onOpen(tournament)}
          />
        ))}
      </div>
      <button className="aether-secondary-action" onClick={onCreate}>
        <i className="ti ti-plus" aria-hidden="true" />
        Nuevo torneo
      </button>
    </section>
  )
}

function TournamentLobbyCard({ tournament, onOpen }: { tournament: Tournament; onOpen: () => void }) {
  const { totalRounds, roundSummaries } = useSwissPairings(tournament.id)
  const playedRounds = roundSummaries.filter(round => round.matchesTotal > 0).length

  return (
    <button className="aether-lobby-card" onClick={onOpen}>
      <span>{statusLabel(tournament.status)}</span>
      <strong>{tournament.name}</strong>
      <small>{tournament.players.length} jugadores - {playedRounds || tournament.currentRound || 0}/{totalRounds || '-'} rondas</small>
    </button>
  )
}

function TournamentHeader({ tournament, onDelete }: { tournament: Tournament; onDelete: () => void }) {
  const { totalRounds, roundSummaries } = useSwissPairings(tournament.id)
  const playedRounds = roundSummaries.filter(round => round.matchesTotal > 0).length

  return (
    <section className="aether-tournament-card" aria-label="Resumen del torneo">
      <div className="aether-tournament-main">
        <span>{statusLabel(tournament.status)}</span>
        <h2>{tournament.name}</h2>
        <p>{tournament.players.length} jugadores - {playedRounds || tournament.currentRound || 0}/{totalRounds || '-'} rondas</p>
      </div>
      <button className="aether-icon-danger" onClick={onDelete} aria-label="Eliminar torneo">
        <i className="ti ti-trash" aria-hidden="true" />
      </button>
    </section>
  )
}

function SetupPanel({ tournament, onGoRound, onDelete }: { tournament: Tournament; onGoRound: () => void; onDelete: () => void }) {
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
      <section className="aether-config-card aether-setup-panel">
        <div className="aether-setup-head">
          <div className="aether-panel-title">
            <span>Preparacion</span>
            <h2>Nuevo torneo</h2>
          </div>
          <div className="aether-setup-tools">
            <div className="aether-pin-card">
              <span>PIN</span>
              <strong>{tournament.creatorPin ?? '0000'}</strong>
            </div>
            <button className="aether-icon-danger subtle" onClick={onDelete} aria-label="Eliminar torneo">
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="aether-field">
          <span>Nombre del torneo</span>
          <input
            value={tournament.name}
            onChange={event => updateTournamentName(tournament.id, event.target.value)}
            placeholder="Torneo YuGiOh"
          />
        </label>

        <div className="aether-meta-row">
          <span>YuGiOh</span>
          <span>Suizo</span>
          <span>{tournament.players.length} jugadores</span>
          {tournament.players.length >= 2 && <span>{totalRounds} rondas</span>}
        </div>

        <div className="aether-section-title compact-title">
          <div>
            <span>Jugadores</span>
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
            <button onClick={handleAddPlayer} disabled={!playerName.trim()} aria-label="Anadir jugador">
              <i className="ti ti-user-plus" aria-hidden="true" />
            </button>
          </div>
        )}

        {error && <div className="aether-error">{error}</div>}

        <div className="aether-list">
          {tournament.players.length === 0 ? (
            <div className="aether-list-empty">Anade al menos 2 jugadores para empezar.</div>
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

        {tournament.status === 'setup' ? (
          <button className="aether-primary" onClick={handleStart} disabled={tournament.players.length < 2}>
            Comenzar ronda 1
          </button>
        ) : (
          <div className="aether-note">El torneo ya esta iniciado.</div>
        )}
      </section>
    </div>
  )
}

function RoundPanel({ tournament, onFinished }: { tournament: Tournament; onFinished: () => void }) {
  const setMatchResult = useTournamentsStore(state => state.setMatchResult)
  const setRoundMatchResult = useTournamentsStore(state => state.setRoundMatchResult)
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
  const [editableMatchId, setEditableMatchId] = useState<string | null>(null)
  const [pinError, setPinError] = useState('')

  function requestEdit(matchId: string) {
    setPinError('')
    const pin = prompt('PIN de creador')
    if (pin !== (tournament.creatorPin ?? '0000')) {
      setPinError('PIN incorrecto. Solo el creador puede modificar resultados.')
      return
    }
    setEditableMatchId(matchId)
  }

  function handleResult(match: Match, result: MatchResult) {
    if (editableMatchId === match.id) {
      setRoundMatchResult(tournament.id, currentRound, match.id, result)
      setEditableMatchId(null)
      return
    }
    setMatchResult(tournament.id, match.id, result)
  }

  if (tournament.status === 'setup') {
    return (
      <div className="aether-empty compact">
        <i className="ti ti-swords" aria-hidden="true" />
        <h2>Sin ronda activa</h2>
        <p>Comienza el torneo desde Jugadores.</p>
      </div>
    )
  }

  return (
    <div className="aether-stack">
      <section className="aether-round-status">
        <div>
          <span>Ronda actual</span>
          <h2>Ronda {currentRound}/{totalRounds}</h2>
          <p>{allResultsIn ? 'Resultados completos.' : 'Resultados pendientes.'}</p>
        </div>
        <div className="aether-share-actions">
          <button onClick={() => void shareRoundImage(`aetherhub-ronda-${currentRound}`)}>
            <i className="ti ti-share-3" aria-hidden="true" />
            Compartir
          </button>
          <button onClick={() => void exportRoundImage(`aetherhub-ronda-${currentRound}`)} aria-label="Descargar imagen">
            <i className="ti ti-download" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="aether-export-stage" aria-hidden="true">
        <RoundExport ref={roundExportRef} tournamentId={tournament.id} type="round" />
      </div>

      <div className="aether-match-list">
        {pinError && <div className="aether-error">{pinError}</div>}
        {currentMatches.map(match => (
          <MatchRow
            key={match.id}
            match={match}
            getPlayerName={getPlayerName}
            isEditing={editableMatchId === match.id}
            onEdit={() => requestEdit(match.id)}
            onCancelEdit={() => setEditableMatchId(null)}
            onResult={result => handleResult(match, result)}
          />
        ))}
      </div>

      {tournament.status === 'active' && (
        <button
          className="aether-primary"
          disabled={!allResultsIn}
          onClick={() => {
            if (shouldFinish) {
              finishTournament(tournament.id)
              onFinished()
              return
            }
            nextRound(tournament.id)
          }}
        >
          {shouldFinish ? 'Finalizar torneo' : 'Siguiente ronda'}
        </button>
      )}

      {tournament.status === 'finished' && (
        <div className="aether-note">Torneo finalizado.</div>
      )}
    </div>
  )
}

function MatchRow({
  match,
  getPlayerName,
  isEditing,
  onEdit,
  onCancelEdit,
  onResult,
}: {
  match: Match
  getPlayerName: (id: string) => string
  isEditing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onResult: (result: MatchResult) => void
}) {
  const p1Name = getPlayerName(match.p1Id)
  const p2Name = getPlayerName(match.p2Id)
  const isLocked = match.result !== null && !isEditing

  return (
    <article className={`aether-match-card ${isLocked ? 'is-locked' : ''}`}>
      <header>
        <span>Mesa {match.tableNumber}</span>
        <strong>{resultLabel(match.result, p1Name, p2Name)}</strong>
      </header>
      <div className="aether-versus">
        <strong>{p1Name}</strong>
        <span>vs</span>
        <strong>{p2Name}</strong>
      </div>

      {isLocked && (
        <div className="aether-locked-result">
          <span>Resultado bloqueado</span>
          <button onClick={onEdit}>
            <i className="ti ti-lock-open" aria-hidden="true" />
            Editar
          </button>
        </div>
      )}

      {match.p2Id !== 'BYE' && !isLocked && (
        <div className="aether-result-buttons">
          <button className={match.result === 'p1' ? 'active' : ''} onClick={() => onResult('p1')}>
            <span>Gana</span>
            <strong>{p1Name}</strong>
          </button>
          <button className={match.result === 'p2' ? 'active' : ''} onClick={() => onResult('p2')}>
            <span>Gana</span>
            <strong>{p2Name}</strong>
          </button>
          <button className={match.result === 'timeout' ? 'active danger' : ''} onClick={() => onResult('timeout')}>Doble loss</button>
        </div>
      )}

      {isEditing && (
        <button className="aether-secondary-action" onClick={onCancelEdit}>
          Cancelar edicion
        </button>
      )}
    </article>
  )
}

function StandingsPanel({ tournament }: { tournament: Tournament }) {
  const { standings } = useSwissPairings(tournament.id)
  const { ref: standingsExportRef, shareImage: shareStandingsImage, exportImage: exportStandingsImage } = useExportImage({ scale: 3 })

  return (
    <div className="aether-stack">
      <section className="aether-round-status standings-hero">
        <div>
          <span>{tournament.status === 'finished' ? 'Final' : 'En curso'}</span>
          <h2>Clasificacion</h2>
          <p>{standings.length} jugadores por puntos.</p>
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
      </section>

      <div className="aether-export-stage" aria-hidden="true">
        <RoundExport ref={standingsExportRef} tournamentId={tournament.id} type="standings" />
      </div>

      <div className="aether-standing-list">
        <div className="aether-standing-header">
          <span>#</span>
          <span>Jugador</span>
          <span>Pts</span>
          <span>V-D</span>
        </div>
        {standings.map(row => (
          <div key={row.player.id} className="aether-standing-row">
            <span>{row.position}</span>
            <strong>{row.player.name}</strong>
            <span>{row.player.points}</span>
            <span>{row.player.wins}-{row.player.losses}</span>
          </div>
        ))}
      </div>
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
