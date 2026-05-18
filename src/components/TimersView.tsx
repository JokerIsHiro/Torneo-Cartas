import { useTournamentsStore } from '../store/tournamentsStore'
import { useTimerData } from '../store/timerStore'
import type { Tournament } from '../types/tournament'

export function TimersView() {
  const tournaments = useTournamentsStore(s =>
    s.tournaments.filter(t => t.status === 'active')
  )

  if (!tournaments.length) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '4rem 1rem',
        color: 'var(--color-text-secondary)',
        fontSize: '13px',
      }}>
        <i className="ti ti-clock-off" aria-hidden="true" style={{ fontSize: '28px' }} />
        <div style={{ marginTop: '8px' }}>No hay torneos activos</div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem',
      padding: '1rem 0',
    }}>
      {tournaments.map(t => (
        <TimerCard key={t.id} tournament={t} />
      ))}
    </div>
  )
}

function TimerCard({ tournament }: { tournament: Tournament }) {
  const timerData = useTimerData(tournament.id)

  if (!timerData) return null

  const { formatted, secondsLeft, isWarning, isDanger, isFinished, status } = timerData
  const progressPercent = (secondsLeft / tournament.timerDuration) * 100

  const barColor = (() => {
    if (isFinished || isDanger) return '#E24B4A'
    if (isWarning)              return '#EF9F27'
    return '#1D9E75'
  })()

  const timeColor = (() => {
    if (isFinished || isDanger) return '#A32D2D'
    if (isWarning)              return '#854F0B'
    return 'var(--color-text-primary)'
  })()

  const statusLabel = (() => {
    if (isFinished)        return '¡Tiempo agotado!'
    if (status === 'idle') return 'Sin iniciar'
    if (status === 'paused') return 'Pausado'
    if (isDanger)          return 'Menos de 5 min'
    if (isWarning)         return 'Menos de 10 min'
    return 'En curso'
  })()

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${isFinished || isDanger ? '#F7C1C1' : 'var(--color-border-tertiary)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '1.25rem',
      transition: 'border-color .3s',
    }}>

      {/* Nombre y ronda */}
      <div style={{ marginBottom: '.875rem' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {tournament.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          Ronda {tournament.currentRound} · Swiss
        </div>
      </div>

      {/* Tiempo grande */}
      <div style={{
        fontSize: '40px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono, monospace)',
        color: timeColor,
        letterSpacing: '2px',
        lineHeight: 1,
        textAlign: 'center',
        marginBottom: '.75rem',
        transition: 'color .3s',
      }}>
        {formatted}
      </div>

      {/* Barra invertida */}
      <div style={{
        height: '5px',
        background: 'var(--color-background-secondary)',
        borderRadius: '3px',
        marginBottom: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: isFinished || isDanger ? '#FCEBEB' : isWarning ? '#FDF3E3' : '#EAF3DE',
          transition: 'background .3s',
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${progressPercent}%`,
          background: barColor,
          borderRadius: '3px',
          transition: 'width 1s linear, background .3s',
        }} />
      </div>

      {/* Estado */}
      <div style={{
        fontSize: '11px',
        textAlign: 'center',
        color: timeColor === 'var(--color-text-primary)' ? 'var(--color-text-secondary)' : timeColor,
        transition: 'color .3s',
      }}>
        {statusLabel}
      </div>
    </div>
  )
}