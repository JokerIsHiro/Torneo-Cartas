import { useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'

interface SetupProps {
  tournamentId: string
}

const timerOptions = [
  { label: '30 min', value: 30 * 60 },
  { label: '40 min', value: 40 * 60 },
  { label: '50 min', value: 50 * 60 },
  { label: '60 min', value: 60 * 60 },
  { label: '75 min', value: 75 * 60 },
]

export function Setup({ tournamentId }: SetupProps) {
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const { updateTournamentName, setTimerDuration, startTournament } = useTournamentsStore()
  const { totalRounds } = useSwissPairings(tournamentId)
  const [error, setError] = useState('')

  if (!tournament) return null

  function handleStart() {
    if (tournament!.players.length < 2) {
      setError('Necesitas al menos 2 jugadores para iniciar')
      return
    }
    startTournament(tournamentId)
  }

  return (
    <div>
      {/* Nombre del torneo */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-tournament" aria-hidden="true" /> Nombre del torneo
        </div>
        <input
          type="text"
          value={tournament.name}
          onChange={e => updateTournamentName(tournamentId, e.target.value)}
          placeholder="Mi Torneo"
          style={inputStyle}
        />
      </div>

      {/* Duración de ronda */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-clock" aria-hidden="true" /> Duración de cada ronda
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {timerOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimerDuration(tournamentId, opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                border: `0.5px solid ${tournament.timerDuration === opt.value
                  ? 'var(--color-border-primary)'
                  : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: tournament.timerDuration === opt.value
                  ? 'var(--color-background-secondary)'
                  : 'var(--color-background-primary)',
                color: tournament.timerDuration === opt.value
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: tournament.timerDuration === opt.value ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jugadores */}
      <PlayerList tournamentId={tournamentId} />

      {/* Resumen */}
      {tournament.players.length >= 2 && (
        <div style={{
          ...cardStyle,
          background: 'var(--color-background-secondary)',
          marginTop: '.75rem',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            textAlign: 'center',
          }}>
            <SummaryCell label="Jugadores"        value={tournament.players.length} />
            <SummaryCell label="Rondas estimadas" value={totalRounds} />
            <SummaryCell label="Tiempo por ronda" value={`${Math.floor(tournament.timerDuration / 60)} min`} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ fontSize: '12px', color: '#A32D2D', margin: '.5rem 0' }}>
          <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
        </div>
      )}

      {/* Botón iniciar */}
      <button
        onClick={handleStart}
        disabled={tournament.players.length < 2}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 500,
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          background: tournament.players.length >= 2
            ? 'var(--color-background-secondary)'
            : 'var(--color-background-primary)',
          color: tournament.players.length >= 2
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
          cursor: tournament.players.length >= 2 ? 'pointer' : 'not-allowed',
          opacity: tournament.players.length < 2 ? 0.5 : 1,
          marginTop: '.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all .15s',
        }}
      >
        <i className="ti ti-player-play" aria-hidden="true" />
        Iniciar torneo
      </button>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '1rem 1.25rem',
  marginBottom: '.75rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.75rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}