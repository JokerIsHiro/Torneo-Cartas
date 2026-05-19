import { useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'

export function RegistrationView() {
  const tournamentId = getTargetTournamentId()
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const addPlayer = useTournamentsStore(s => s.addPlayer)
  const [name, setName] = useState('')
  const [registeredName, setRegisteredName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!tournament) {
    return (
      <div className="registration-card">
        <i className="ti ti-link-off" aria-hidden="true" />
        <h1>Enlace no disponible</h1>
        <p>Este dispositivo no tiene acceso a los datos del torneo.</p>
      </div>
    )
  }

  const currentTournament = tournament
  const isOpen = tournament.status === 'setup'

  if (registeredName) {
    return (
      <div className="registration-card">
        <i className="ti ti-circle-check" aria-hidden="true" />
        <h1>Inscripción recibida</h1>
        <p>{registeredName} ya está apuntado a {tournament.name}.</p>
        <div className="registration-meta">
          Puedes cerrar esta pestaña.
        </div>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const playerName = name.trim()

    setMessage('')
    setError('')

    if (!isOpen) {
      setError('La inscripción ya está cerrada.')
      return
    }

    if (!playerName) {
      setError('Escribe tu nombre para inscribirte.')
      return
    }

    if (currentTournament.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      setError('Ese nombre ya está inscrito.')
      return
    }

    addPlayer(currentTournament.id, playerName)
    setRegisteredName(playerName)
    setName('')
    setMessage('Inscripción recibida.')
  }

  return (
    <div className="registration-card">
      <i className="ti ti-ticket" aria-hidden="true" />
      <h1>{tournament.name}</h1>
      <p>{isOpen ? 'Introduce tu nombre para apuntarte al torneo.' : 'La inscripción para este torneo está cerrada.'}</p>

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

function getTargetTournamentId() {
  const queryStart = window.location.hash.indexOf('?')
  if (queryStart === -1) return ''
  const params = new URLSearchParams(window.location.hash.slice(queryStart + 1))
  return params.get('torneo') ?? ''
}
