// Pantalla publica de inscripcion de jugadores. Cambia aqui el formulario visible
// desde QR/enlace, no la gestion interna de participantes.
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Match, MatchResult, Player, Tournament } from '../types/tournament'

interface PlayerSession {
  tournamentId: string
  playerId: string
}

// Pantalla publica de inscripcion y panel persistente del jugador.
export function RegistrationView() {
  const tournamentId = getTargetTournamentId()
  const playerIdFromLink = getTargetPlayerId()
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const { syncEnabled, syncLoaded } = useTournamentsStore(
    useShallow(s => ({
      syncEnabled: s.syncEnabled,
      syncLoaded: s.syncLoaded,
    }))
  )
  const addPlayer = useTournamentsStore(s => s.addPlayer)
  const submitPlayerResult = useTournamentsStore(s => s.submitPlayerResult)
  const submitDecklist = useTournamentsStore(s => s.submitDecklist)
  const [name, setName] = useState('')
  const [createdSession, setCreatedSession] = useState<PlayerSession | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const linkSession = useMemo(
    () => tournamentId && playerIdFromLink
      ? { tournamentId, playerId: playerIdFromLink }
      : null,
    [playerIdFromLink, tournamentId]
  )
  const session = linkSession
    ?? (createdSession?.tournamentId === tournamentId ? createdSession : loadPlayerSession(tournamentId))

  const registeredPlayer = useMemo(() => {
    if (!tournament || !session || session.tournamentId !== tournament.id) return null
    return tournament.players.find(p => p.id === session.playerId) ?? null
  }, [session, tournament])

  useEffect(() => {
    if (!linkSession || !registeredPlayer) return
    savePlayerSession(linkSession)
  }, [linkSession, registeredPlayer])

  if (!tournamentId) {
    return (
      <div className="registration-card">
        <i className="ti ti-link-off" aria-hidden="true" />
        <h1>Enlace no disponible</h1>
        <p>Falta el identificador del torneo en el enlace.</p>
      </div>
    )
  }

  if (!tournament && syncEnabled && !syncLoaded) {
    return (
      <div className="registration-card">
        <i className="ti ti-loader-2" aria-hidden="true" />
        <h1>Cargando torneo</h1>
        <p>Estamos sincronizando los datos del evento.</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="registration-card">
        <i className="ti ti-link-off" aria-hidden="true" />
        <h1>Enlace no disponible</h1>
        <p>No se ha encontrado este torneo. Revisa que el enlace sea el ultimo generado por el organizador.</p>
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
        onSubmitDeck={(deck) => {
          submitDecklist(tournament.id, registeredPlayer.id, deck)
          setMessage('Lista de mazo guardada.')
          setError('')
        }}
        playerLink={getPlayerPortalLink(tournament.id, registeredPlayer.id)}
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
        <button disabled={!isOpen} title="Registrate en este torneo con el nombre indicado">
          <i className="ti ti-user-plus" aria-hidden="true" />
          Apuntarme al torneo
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
  onSubmitDeck,
  message,
  error,
  playerLink,
}: {
  player: Player
  tournament: Tournament
  onSubmitResult: (matchId: string, result: Exclude<MatchResult, 'bye' | null>) => void
  onSubmitDeck: (deck: { name: string; archetype?: string; list: string; notes: string }) => void
  message: string
  error: string
  playerLink: string
}) {
  const { standings } = useSwissPairings(tournament.id)
  const existingDeck = [...(tournament.decklists ?? [])].reverse().find(deck => deck.playerId === player.id)
  const [deckArchetype, setDeckArchetype] = useState(existingDeck?.archetype ?? existingDeck?.name ?? '')
  const [deckName, setDeckName] = useState(existingDeck?.name ?? '')
  const [deckList, setDeckList] = useState(existingDeck?.list ?? '')
  const [deckNotes, setDeckNotes] = useState(existingDeck?.notes ?? '')
  const standing = standings.find(row => row.player.id === player.id)
  const isDropped = Boolean(player.droppedAt)
  const round = tournament.rounds[tournament.currentRound - 1]
  const match = round?.matches.find(m => getMatchPlayerIds(m).includes(player.id))
  const matchPlayerIds = match ? getMatchPlayerIds(match) : []
  const opponents = matchPlayerIds
    .filter(playerId => playerId !== player.id)
    .map(playerId => playerId === 'BYE'
      ? 'BYE'
      : tournament.players.find(p => p.id === playerId)?.name ?? 'Rival')
  const isPodMatch = matchPlayerIds.length > 2
  const pendingResult = tournament.pendingResults?.find(p =>
    p.playerId === player.id && p.matchId === match?.id
  )
  const playerHistory = tournament.rounds
    .map(historyRound => {
      const historyMatch = historyRound.matches.find(m => getMatchPlayerIds(m).includes(player.id))
      if (!historyMatch) return null
      const historyOpponent = getMatchPlayerIds(historyMatch)
        .filter(playerId => playerId !== player.id)
        .map(playerId => playerId === 'BYE'
          ? 'BYE'
          : tournament.players.find(candidate => candidate.id === playerId)?.name ?? 'Rival')
        .join(' · ')
      return {
        roundNumber: historyRound.number,
        tableNumber: historyMatch.tableNumber,
        opponent: historyOpponent,
        result: getResultLabelForPlayer(historyMatch, player.id),
      }
    })
    .filter(Boolean)
  const allowsDraw = tournament.tcg !== 'yugioh'
  const canReport = !isDropped && tournament.status === 'active' && match && match.p2Id !== 'BYE' && match.result === null
  const portalStatus = isDropped
    ? 'Retirado'
    : tournament.status === 'finished'
      ? 'Finalizado'
      : tournament.status === 'setup'
        ? 'Inscrito'
        : match
          ? `Mesa ${match.tableNumber}`
          : 'Esperando ronda'

  function resultFromPlayerPerspective(playerWon: boolean): Exclude<MatchResult, 'bye' | null> {
    if (!match) return 'draw'
    if (isPodMatch) return resultForPlayerId(match, player.id)
    if (playerWon) return match.p1Id === player.id ? 'p1' : 'p2'
    return match.p1Id === player.id ? 'p2' : 'p1'
  }

  return (
    <div className="registration-card player-portal">
      <header className="player-portal-hero">
        <div>
          <span>{tournament.name}</span>
          <h1>{player.name}</h1>
        </div>
        <strong>{portalStatus}</strong>
      </header>

      <div className="player-summary-grid">
        <div>
          <span>Posicion</span>
          <strong>{standing ? `#${standing.position}` : '-'}</strong>
        </div>
        <div>
          <span>Puntos</span>
          <strong>{player.points}</strong>
        </div>
        <div>
          <span>Record</span>
          <strong>{player.wins}-{player.draws}-{player.losses}</strong>
        </div>
      </div>

      {isDropped && (
        <div className="registration-feedback error">
          Estas retirado del torneo. No seras emparejado en las siguientes rondas.
        </div>
      )}

      {tournament.status === 'setup' && (
        <div className="player-panel player-current-panel">
          <strong>Inscripcion confirmada</strong>
          <span>Espera a que el organizador inicie la primera ronda.</span>
        </div>
      )}

      {tournament.status === 'active' && match && (
        <div className="player-panel player-current-panel">
          <div className="player-match-table">Mesa {match.tableNumber}</div>
          <strong>Ronda {tournament.currentRound}</strong>
          <span>{opponents.length ? `Mesa con ${opponents.join(' · ')}` : 'Esperando rival'}</span>

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
              <button onClick={() => onSubmitResult(match.id, resultFromPlayerPerspective(true))} title="Envia victoria para que el organizador la confirme">
                <i className="ti ti-trophy" aria-hidden="true" />
                {isPodMatch ? 'Reportar mi victoria' : 'Reportar victoria'}
              </button>
              {allowsDraw && (
                <button onClick={() => onSubmitResult(match.id, 'draw')} title="Envia empate para confirmacion">
                  <i className="ti ti-equal" aria-hidden="true" />
                  Reportar empate
                </button>
              )}
              {!isPodMatch && (
                <button onClick={() => onSubmitResult(match.id, resultFromPlayerPerspective(false))} title="Envia derrota para confirmacion">
                  <i className="ti ti-flag" aria-hidden="true" />
                  Reportar derrota
                </button>
              )}
            </div>
          )}

          {pendingResult && (
            <div className="registration-meta">
              Resultado enviado. Falta confirmacion del organizador.
            </div>
          )}
        </div>
      )}

      {tournament.status === 'active' && !match && !isDropped && (
        <div className="player-panel player-current-panel">
          <strong>Sin emparejamiento activo</strong>
          <span>Espera a que se publique la siguiente ronda.</span>
        </div>
      )}

      {tournament.status === 'finished' && (
        <div className="player-panel player-current-panel">
          <strong>Torneo finalizado</strong>
          <span>{player.points} puntos finales</span>
        </div>
      )}

      <details className="player-panel player-link-panel">
        <summary>
          <strong>Enlace personal</strong>
          <span>Consultar desde otro dispositivo</span>
        </summary>
        <input value={playerLink} readOnly onFocus={event => event.currentTarget.select()} />
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(playerLink)}
          title="Copia tu enlace personal"
        >
          <i className="ti ti-copy" aria-hidden="true" />
          Copiar enlace
        </button>
      </details>

      {playerHistory.length > 0 && (
        <div className="player-panel player-history-panel">
          <strong>Historial de rondas</strong>
          {playerHistory.map(item => item && (
            <div key={item.roundNumber} className="player-history-row">
              <span>R{item.roundNumber} · Mesa {item.tableNumber}</span>
              <div>
                <strong>{item.opponent}</strong>
                <em>{item.result}</em>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="player-panel deck-submit-panel"
        onSubmit={event => {
          event.preventDefault()
          onSubmitDeck({ name: deckName, archetype: deckArchetype, list: deckList, notes: deckNotes })
        }}
      >
        <strong>Mazo del torneo</strong>
        <span>Envia tu lista cuando la tengas. La tienda decidira que listas se publican al finalizar.</span>
        <input
          value={deckArchetype}
          onChange={event => setDeckArchetype(event.target.value)}
          placeholder="Arquetipo (ej. Enel, Mono Red, Charizard)"
        />
        <input
          value={deckName}
          onChange={event => setDeckName(event.target.value)}
          placeholder="Nombre de publicacion"
        />
        <textarea
          value={deckList}
          onChange={event => setDeckList(event.target.value)}
          placeholder="Lista del mazo"
          rows={8}
        />
        <textarea
          value={deckNotes}
          onChange={event => setDeckNotes(event.target.value)}
          placeholder="Notas opcionales"
          rows={3}
        />
        <button type="submit" disabled={!deckName.trim() || !deckList.trim()} title="Envia tu lista al organizador del torneo">
          <i className="ti ti-device-floppy" aria-hidden="true" />
          {existingDeck ? 'Actualizar mi mazo' : 'Enviar mi mazo'}
        </button>
        {existingDeck && (
          <div className="registration-meta">
            Estado: {existingDeck.status === 'published' ? 'publicado' : 'recibido'}
          </div>
        )}
      </form>

      {(message || error) && (
        <div className={error ? 'registration-feedback error' : 'registration-feedback'}>
          {error || message}
        </div>
      )}
    </div>
  )
}

function getResultLabelForPlayer(match: Match, playerId: string) {
  const result = match.result
  if (result === null) return 'Pendiente'
  if (result === 'bye' || match.p2Id === 'BYE') return 'BYE'
  if (result === 'draw') return 'Empate'
  if (result === 'timeout') return 'Tiempo'
  if (getWinnerPlayerId(match) === playerId) return 'Victoria'
  return 'Derrota'
}

function getMatchPlayerIds(match: Match): string[] {
  if (match.playerIds?.length) return match.playerIds
  return match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
}

function resultForPlayerId(match: Match, playerId: string): Exclude<MatchResult, 'bye' | null> {
  const index = getMatchPlayerIds(match).indexOf(playerId)
  if (index < 0) return 'timeout'
  return `p${index + 1}` as Exclude<MatchResult, 'bye' | null>
}

function getWinnerPlayerId(match: Match) {
  if (!match.result || match.result === 'draw' || match.result === 'timeout' || match.result === 'bye') return ''
  const index = Number(match.result.slice(1)) - 1
  return getMatchPlayerIds(match)[index] ?? ''
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

function getTargetPlayerId() {
  const searchParams = new URLSearchParams(window.location.search)
  const searchPlayer = searchParams.get('jugador')
  if (searchPlayer) return searchPlayer

  const queryStart = window.location.hash.indexOf('?')
  if (queryStart === -1) return ''
  const hashParams = new URLSearchParams(window.location.hash.slice(queryStart + 1))
  return hashParams.get('jugador') ?? ''
}

function getPlayerPortalLink(tournamentId: string, playerId: string) {
  const publicUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
  const url = new URL('/jugador', publicUrl)
  url.searchParams.set('torneo', tournamentId)
  url.searchParams.set('jugador', playerId)
  return url.toString()
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
