import { useEffect } from 'react'
import { useTimer } from '../hooks/useTimer'
import { useTournamentStore } from '../store/tournamentStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

export function Timer() {
  const { timerDuration, applyTimeoutToUnfinished, currentRound } = useTournamentStore()
  const { allResultsIn, unfinishedCount } = useSwissPairings()

  const timer = useTimer({
    durationSeconds: timerDuration,
    onFinish: () => {
      applyTimeoutToUnfinished()
    },
  })

  // Cuando cambia la ronda, reiniciar e iniciar automáticamente
  useEffect(() => {
    if (currentRound > 0) {
      timer.reset()
      timer.start()
    }
  }, [currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pausar automáticamente si todos los resultados están introducidos
  useEffect(() => {
    if (allResultsIn && timer.status === 'running') {
      timer.pause()
    }
  }, [allResultsIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = (() => {
    if (timer.status === 'finished') return '¡Tiempo agotado!'
    if (timer.status === 'idle')     return 'Esperando inicio'
    if (timer.status === 'paused' && allResultsIn) return 'Todos los resultados introducidos'
    if (timer.status === 'paused')   return 'Pausado'
    if (timer.isDanger)              return 'Menos de 5 minutos'
    if (timer.isWarning)             return 'Menos de 10 minutos'
    return 'Ronda en curso'
  })()

  const timerColor = (() => {
    if (timer.status === 'finished') return '#A32D2D'
    if (timer.isDanger)              return '#A32D2D'
    if (timer.isWarning)             return '#854F0B'
    return 'var(--color-text-primary)'
  })()

  const progressColor = (() => {
    if (timer.status === 'finished') return '#E24B4A'
    if (timer.isDanger)              return '#E24B4A'
    if (timer.isWarning)             return '#EF9F27'
    return '#1D9E75'
  })()

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    }}>

      {/* Barra de progreso */}
      <div style={{
        height: '4px',
        background: 'var(--color-background-secondary)',
        borderRadius: '2px',
        marginBottom: '1.25rem',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${timer.progress * 100}%`,
          background: progressColor,
          borderRadius: '2px',
          transition: 'width 1s linear, background 0.3s',
        }} />
      </div>

      {/* Tiempo */}
      <div style={{
        fontSize: '56px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono)',
        color: timerColor,
        letterSpacing: '2px',
        lineHeight: 1,
        textAlign: 'center',
        transition: 'color 0.3s',
      }}>
        {timer.formatted}
      </div>

      {/* Estado */}
      <div style={{
        fontSize: '13px',
        color: timerColor === 'var(--color-text-primary)'
          ? 'var(--color-text-secondary)'
          : timerColor,
        textAlign: 'center',
        marginTop: '6px',
        marginBottom: '1.25rem',
        transition: 'color 0.3s',
      }}>
        {statusLabel}
        {unfinishedCount > 0 && timer.status === 'running' && (
          <span style={{ marginLeft: '8px', opacity: 0.7 }}>
            · {unfinishedCount} {unfinishedCount === 1 ? 'mesa sin resultado' : 'mesas sin resultado'}
          </span>
        )}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>

        {timer.status === 'idle' && (
          <button onClick={timer.start} style={btnStyle}>
            <i className="ti ti-player-play" aria-hidden="true" /> Iniciar
          </button>
        )}

        {timer.status === 'running' && (
          <button onClick={timer.pause} style={btnStyle}>
            <i className="ti ti-player-pause" aria-hidden="true" /> Pausar
          </button>
        )}

        {timer.status === 'paused' && (
          <button onClick={timer.resume} style={btnStyle}>
            <i className="ti ti-player-play" aria-hidden="true" /> Continuar
          </button>
        )}

        {timer.status === 'finished' && (
          <button style={{ ...btnStyle, color: '#A32D2D', borderColor: '#F09595' }} disabled>
            <i className="ti ti-clock-off" aria-hidden="true" /> Tiempo agotado
          </button>
        )}

        <button
          onClick={timer.reset}
          disabled={timer.status === 'idle'}
          style={{
            ...btnStyle,
            opacity: timer.status === 'idle' ? 0.4 : 1,
            cursor: timer.status === 'idle' ? 'not-allowed' : 'pointer',
          }}
        >
          <i className="ti ti-rotate" aria-hidden="true" /> Reiniciar
        </button>

      </div>
    </div>
  )
}

// Estilo base de botones extraído para no repetirlo
const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
}