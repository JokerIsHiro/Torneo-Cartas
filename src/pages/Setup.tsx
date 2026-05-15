import { useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'
import { cardStyle, cardTitleStyle, inputStyle } from '../styles/shared'

export function Setup() {
  const { name, setTournamentName, startTournament, players, timerDuration, setTimerDuration } = useTournamentStore()
  const { totalRounds } = useSwissPairings()
  const [nameInput, setNameInput] = useState(name)
  const [error, setError] = useState('')

  const timerOptions = [
    { label: '30 min', value: 30 * 60 },
    { label: '40 min', value: 40 * 60 },
    { label: '50 min', value: 50 * 60 },
    { label: '60 min', value: 60 * 60 },
    { label: '75 min', value: 75 * 60 },
  ]

  function handleStart() {
    if (players.length < 2) {
      setError('Necesitas al menos 2 jugadores para iniciar')
      return
    }
    setTournamentName(nameInput.trim() || 'Mi Torneo')
    startTournament()
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
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
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
              onClick={() => setTimerDuration(opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                border: `0.5px solid ${timerDuration === opt.value ? 'var(--color-border-primary)' : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: timerDuration === opt.value ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                color: timerDuration === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: timerDuration === opt.value ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jugadores */}
      <PlayerList />

      {/* Resumen antes de iniciar */}
      {players.length >= 2 && (
        <div style={{
          ...cardStyle,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          marginTop: '.75rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
            <SummaryCell label="Jugadores" value={players.length} />
            <SummaryCell label="Rondas estimadas" value={totalRounds} />
            <SummaryCell label="Tiempo por ronda" value={`${Math.floor(timerDuration / 60)} min`} />
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
        disabled={players.length < 2}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 500,
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          background: players.length >= 2 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
          color: players.length >= 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: players.length >= 2 ? 'pointer' : 'not-allowed',
          opacity: players.length < 2 ? 0.5 : 1,
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