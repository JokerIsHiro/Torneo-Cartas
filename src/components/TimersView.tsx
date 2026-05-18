import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useTimerData, useTimerStore } from '../store/timerStore'
import type { Tournament } from '../types/tournament'
import { CircularTimer } from './CircularTimer'

export function TimersView() {
  const viewRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const tournaments = useTournamentsStore(
    useShallow(s => s.tournaments.filter(t => t.status === 'active'))
  )

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === viewRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    if (!viewRef.current) return

    if (document.fullscreenElement === viewRef.current) {
      await document.exitFullscreen()
      return
    }

    await viewRef.current.requestFullscreen()
  }

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
    <div ref={viewRef} style={{
      width: '100%',
      minHeight: isFullscreen ? '100vh' : undefined,
      background: isFullscreen ? 'var(--color-background-secondary)' : 'transparent',
      padding: isFullscreen ? '1.5rem' : '0',
      overflow: isFullscreen ? 'auto' : undefined,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: isFullscreen ? '1.25rem' : '.75rem',
      }}>
        <button
          onClick={toggleFullscreen}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <i className={`ti ${isFullscreen ? 'ti-minimize' : 'ti-maximize'}`} aria-hidden="true" />
          {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isFullscreen
          ? 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))'
          : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: isFullscreen ? '1.5rem' : '1rem',
        paddingBottom: '1rem',
      }}>
        {tournaments.map(t => (
          <TimerCard key={t.id} tournament={t} large={isFullscreen} />
        ))}
      </div>
    </div>
  )
}

function TimerCard({ tournament, large }: { tournament: Tournament; large: boolean }) {
  const initTimer   = useTimerStore(s => s.initTimer)
  const startTimer  = useTimerStore(s => s.startTimer)
  const pauseTimer  = useTimerStore(s => s.pauseTimer)
  const resumeTimer = useTimerStore(s => s.resumeTimer)
  const resetTimer  = useTimerStore(s => s.resetTimer)
  const timerData = useTimerData(tournament.id)

  useEffect(() => {
    initTimer(tournament.id, tournament.timerDuration)
  }, [initTimer, tournament.id, tournament.timerDuration])

  if (!timerData) return null

  const { formatted, secondsLeft, isWarning, isDanger, isFinished, status } = timerData
  const progress = secondsLeft / tournament.timerDuration

  const timerColor = (() => {
    if (isFinished || isDanger) return 'var(--color-text-danger)'
    if (isWarning)              return 'var(--color-text-warning)'
    return 'var(--color-accent-primary)'
  })()

  const timeColor = (() => {
    if (isFinished || isDanger) return 'var(--color-text-danger)'
    if (isWarning)              return 'var(--color-text-warning)'
    return 'var(--color-text-primary)'
  })()

  const statusLabel = (() => {
    if (isFinished)          return 'Tiempo agotado'
    if (status === 'idle')   return 'Sin iniciar'
    if (status === 'paused') return 'Pausado'
    if (isDanger)            return 'Menos de 5 min'
    if (isWarning)           return 'Menos de 10 min'
    return 'En curso'
  })()

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${isFinished || isDanger ? 'var(--color-border-danger)' : 'var(--color-border-tertiary)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: large ? '1.5rem' : '1.25rem',
      transition: 'border-color .3s',
    }}>
      <div style={{ marginBottom: large ? '1rem' : '.875rem' }}>
        <div style={{
          fontSize: large ? '18px' : '14px',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {tournament.name}
        </div>
        <div style={{ fontSize: large ? '13px' : '11px', color: 'var(--color-text-secondary)' }}>
          Ronda {tournament.currentRound} &middot; Swiss
        </div>
      </div>

      <div style={{ marginBottom: large ? '1.125rem' : '.875rem' }}>
        <CircularTimer
          formatted={formatted}
          progress={progress}
          color={timerColor}
          trackColor={isFinished || isDanger ? 'var(--color-danger-bg)' : isWarning ? 'var(--color-warning-bg)' : 'var(--color-success-bg)'}
          glowColor={isFinished || isDanger ? 'rgba(255, 107, 122, 0.18)' : isWarning ? 'rgba(255, 209, 102, 0.14)' : 'rgba(31, 122, 255, 0.16)'}
          size={large ? 'min(46vh, 72vw, 390px)' : 'min(58vw, 220px)'}
          strokeWidth={large ? 6.5 : 6.5}
          label={statusLabel}
          labelColor={timeColor === 'var(--color-text-primary)' ? 'var(--color-text-secondary)' : timeColor}
          timeColor={timeColor}
          timeSize={large ? 'clamp(54px, 8vw, 92px)' : 'clamp(34px, 10vw, 46px)'}
        />
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {status === 'idle' && (
          <TimerActionButton
            onClick={() => startTimer(tournament.id)}
            icon="ti-player-play"
            label="Iniciar"
          />
        )}
        {status === 'running' && (
          <TimerActionButton
            onClick={() => pauseTimer(tournament.id)}
            icon="ti-player-pause"
            label="Pausar"
          />
        )}
        {status === 'paused' && (
          <TimerActionButton
            onClick={() => resumeTimer(tournament.id)}
            icon="ti-player-play"
            label="Continuar"
          />
        )}
        {isFinished && (
          <TimerActionButton
            onClick={() => {}}
            icon="ti-clock-off"
            label="Agotado"
            disabled
            color="var(--color-text-danger)"
          />
        )}
        <TimerActionButton
          onClick={() => resetTimer(tournament.id, tournament.timerDuration)}
          icon="ti-rotate"
          label="Reiniciar"
          disabled={status === 'idle'}
        />
      </div>
    </div>
  )
}

interface TimerActionButtonProps {
  onClick: () => void
  icon: string
  label: string
  disabled?: boolean
  color?: string
}

function TimerActionButton({ onClick, icon, label, disabled, color }: TimerActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        minWidth: '92px',
        fontSize: '12px',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--color-background-primary)',
        color: color ?? 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
      {label}
    </button>
  )
}
