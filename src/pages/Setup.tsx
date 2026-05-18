import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'
import type { TournamentTCG } from '../types/tournament'

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

const tcgOptions: Array<{ label: string; value: TournamentTCG }> = [
  { label: 'Magic', value: 'magic' },
  { label: 'Riftbound', value: 'riftbound' },
  { label: 'Pokemon', value: 'pokemon' },
  { label: 'YuGiOh', value: 'yugioh' },
  { label: 'One Piece', value: 'one-piece' },
]

export function Setup({ tournamentId }: SetupProps) {
  const { name, tcg, timerDuration, playerCount, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists:       !!t,
        name:         t?.name          ?? '',
        tcg:          t?.tcg           ?? 'magic',
        timerDuration: t?.timerDuration ?? 50 * 60,
        playerCount:  t?.players.length ?? 0,
      }
    })
  )
  const updateTournamentName = useTournamentsStore(s => s.updateTournamentName)
  const setTournamentTCG     = useTournamentsStore(s => s.setTournamentTCG)
  const setTimerDuration     = useTournamentsStore(s => s.setTimerDuration)
  const startTournament      = useTournamentsStore(s => s.startTournament)
  const { totalRounds }      = useSwissPairings(tournamentId)
  const [error, setError]    = useState('')

  if (!exists) return null

  function handleStart() {
    if (playerCount < 2) {
      setError('Necesitas al menos 2 jugadores para iniciar')
      return
    }
    startTournament(tournamentId)
  }

  return (
    <div>
      <div style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-tournament" aria-hidden="true" /> Nombre del torneo
        </div>
        <input
          type="text"
          value={name}
          onChange={e => updateTournamentName(tournamentId, e.target.value)}
          placeholder="Mi Torneo"
          style={inputStyle}
        />
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-cards" aria-hidden="true" /> Juego
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tcgOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTournamentTCG(tournamentId, opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                border: `0.5px solid ${tcg === opt.value ? 'var(--color-border-primary)' : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: tcg === opt.value ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                color: tcg === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: tcg === opt.value ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {tcg === 'yugioh' && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '.75rem' }}>
            <i className="ti ti-info-circle" aria-hidden="true" /> En YuGiOh no hay empate: victoria o derrota. Si se acaba el tiempo, ambos jugadores pierden.
          </div>
        )}
      </div>

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

      <PlayerList tournamentId={tournamentId} />

      {playerCount >= 2 && (
        <div style={{
          ...cardStyle,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-primary)',
          borderRadius: 'var(--border-radius-lg)',
          marginTop: '.75rem',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            textAlign: 'center',
          }}>
            <SummaryCell label="Jugadores"        value={playerCount} />
            <SummaryCell label="Rondas estimadas" value={totalRounds} />
            <SummaryCell label="Tiempo por ronda" value={`${Math.floor(timerDuration / 60)} min`} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-danger)', margin: '.5rem 0' }}>
          <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={playerCount < 2}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 500,
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          background: playerCount >= 2 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
          color: playerCount >= 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: playerCount >= 2 ? 'pointer' : 'not-allowed',
          opacity: playerCount < 2 ? 0.5 : 1,
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
