import { useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import type { MatchResult, Player, Tournament } from '../types/tournament'

interface PlayerSession {
  tournamentId: string
  playerId: string
}

// Pantalla publica de inscripcion y panel persistente del jugador.
export function RegistrationView() {
  const tournamentId = getTargetTournamentId()
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const addPlayer = useTournamentsStore(s => s.addPlayer)
  const submitPlayerResult = useTournamentsStore(s => s.submitPlayerResult)
  const [name, setName] = useState('')
  const [createdSession, setCreatedSession] = useState<PlayerSession | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const session = createdSession?.tournamentId === tournamentId
    ? createdSession
    : loadPlayerSession(tournamentId)

  const registeredPlayer = useMemo(() => {
    if (!tournament || !session || session.tournamentId !== tournament.id) return null
    return tournament.players.find(p => p.id === session.playerId) ?? null
  }, [session, tournament])

  if (!tournament) {
    return (
      <div className="registration-card">
        <i className="ti ti-link-off" aria-hidden="true" />
        <h1>Enlace no disponible</h1>
        <p>Este dispositivo no tiene acceso a los datos del torneo.</p>
      </div>
    )
  }

  if (registeredPlayer) {
    return (
      <PlayerPortal
        player={registeredPlayer}
        tournament={tournament}
        message={message}
        error={error}
        onSubmitResult={(matchId, result) => {
          submitPlayerResult(tournament.id, matchId, registeredPlayer.id, result)
          setMessage('Resultado enviado al organizador.')
          setError('')
        }}
      />
    )
  }

  const isOpen = tournament.status === 'setup'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tournament) return

    const playerName = name.trim()
    setMessage('')
    setError('')

    if (!isOpen) {
      setError('La inscripcion ya esta cerrada.')
      return
    }

    if (!playerName) {
      setError('Escribe tu nombre para inscribirte.')
      return
    }

    if (tournament.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      setError('Ese nombre ya esta inscrito.')
      return
    }

    const playerId = addPlayer(tournament.id, playerName)
    if (!playerId) {
      setError('No se ha podido completar la inscripcion.')
      return
    }

    const nextSession = { tournamentId: tournament.id, playerId }
    savePlayerSession(nextSession)
    setCreatedSession(nextSession)
    setName('')
    setMessage('Inscripcion recibida.')
  }

  return (
    <div className="registration-card">
      <i className="ti ti-ticket" aria-hidden="true" />
      <h1>{tournament.name}</h1>
      <p>{isOpen ? 'Introduce tu nombre para apuntarte al torneo.' : 'La inscripcion para este torneo esta cerrada.'}</p>

      <form onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError(''); setMessage('') }}
          placeholder="Nombre del jugador"
          disabled={!isOpen}
        />
        <button disabled={!isOpen}>
          <i className="ti ti-user-plus" aria-hidden="true" />
          Inscribirme
        </button>
      </form>

      {(message || error) && (
        <div className={error ? 'registration-feedback error' : 'registration-feedback'}>
          {error || message}
        </div>
      )}

      <div className="registration-meta">
        {tournament.players.length} inscritos
      </div>
    </div>
  )
}

function PlayerPortal({
  player,
  tournament,
  onSubmitResult,
  message,
  error,
}: {
  player: Player
  tournament: Tournament
  onSubmitResult: (matchId: string, result: Exclude<MatchResult, 'bye' | null>) => void
  message: string
  error: string
}) {
  const round = tournament.rounds[tournament.currentRound - 1]
  const match = round?.matches.find(m => m.p1Id === player.id || m.p2Id === player.id)
  const opponentId = match?.p1Id === player.id ? match.p2Id : match?.p1Id
  const opponent = opponentId === 'BYE'
    ? 'BYE'
    : tournament.players.find(p => p.id === opponentId)?.name
  const pendingResult = tournament.pendingResults?.find(p =>
    p.playerId === player.id && p.matchId === match?.id
  )
  const allowsDraw = tournament.tcg !== 'yugioh'
  const canReport = tournament.status === 'active' && match && match.p2Id !== 'BYE' && match.result === null

  function resultFromPlayerPerspective(playerWon: boolean): Exclude<MatchResult, 'bye' | null> {
    if (!match) return 'draw'
    if (playerWon) return match.p1Id === player.id ? 'p1' : 'p2'
    return match.p1Id === player.id ? 'p2' : 'p1'
  }

  return (
    <div className="registration-card player-portal">
      <i className="ti ti-user-check" aria-hidden="true" />
      <h1>{player.name}</h1>
      <p>{tournament.name}</p>

      {tournament.status === 'setup' && (
        <div className="player-panel">
          <strong>Inscripcion confirmada</strong>
          <span>Espera a que el organizador inicie la primera ronda.</span>
        </div>
      )}

      {tournament.status === 'active' && match && (
        <div className="player-panel">
          <div className="player-match-table">Mesa {match.tableNumber}</div>
          <strong>Ronda {tournament.currentRound}</strong>
          <span>{opponent ? `Contra ${opponent}` : 'Esperando rival'}</span>

          {match.p2Id === 'BYE' && (
            <div className="registration-feedback">
              Tienes BYE esta ronda.
            </div>
          )}

          {match.result !== null && match.p2Id !== 'BYE' && (
            <div className="registration-feedback">
              Resultado ya registrado.
            </div>
          )}

          {canReport && (
            <div className="player-result-actions">
              <button onClick={() => onSubmitResult(match.id, resultFromPlayerPerspective(true))}>
                <i className="ti ti-trophy" aria-hidden="true" />
                He ganado
              </button>
              {allowsDraw && (
                <button onClick={() => onSubmitResult(match.id, 'draw')}>
                  <i className="ti ti-equal" aria-hidden="true" />
                  Empate
                </button>
              )}
              <button onClick={() => onSubmitResult(match.id, resultFromPlayerPerspective(false))}>
                <i className="ti ti-flag" aria-hidden="true" />
                He perdido
              </button>
            </div>
          )}

          {pendingResult && (
            <div className="registration-meta">
              Resultado enviado. Falta confirmacion del organizador.
            </div>
          )}
        </div>
      )}

      {tournament.status === 'active' && !match && (
        <div className="player-panel">
          <strong>Sin emparejamiento activo</strong>
          <span>Espera a que se publique la siguiente ronda.</span>
        </div>
      )}

      {tournament.status === 'finished' && (
        <div className="player-panel">
          <strong>Torneo finalizado</strong>
          <span>{player.points} puntos finales</span>
        </div>
      )}

      {(message || error) && (
        <div className={error ? 'registration-feedback error' : 'registration-feedback'}>
          {error || message}
        </div>
      )}
    </div>
  )
}

function getTargetTournamentId() {
  const searchParams = new URLSearchParams(window.location.search)
  const searchTournament = searchParams.get('torneo')
  if (searchTournament) return searchTournament

  const queryStart = window.location.hash.indexOf('?')
  if (queryStart === -1) return ''
  const hashParams = new URLSearchParams(window.location.hash.slice(queryStart + 1))
  return hashParams.get('torneo') ?? ''
}

function getPlayerSessionKey(tournamentId: string) {
  return `torneo-player-session:${tournamentId}`
}

function loadPlayerSession(tournamentId: string): PlayerSession | null {
  if (!tournamentId) return null
  try {
    const raw = window.localStorage.getItem(getPlayerSessionKey(tournamentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlayerSession
    return parsed.tournamentId === tournamentId && parsed.playerId ? parsed : null
  } catch {
    return null
  }
}

function savePlayerSession(session: PlayerSession) {
  window.localStorage.setItem(getPlayerSessionKey(session.tournamentId), JSON.stringify(session))
}
