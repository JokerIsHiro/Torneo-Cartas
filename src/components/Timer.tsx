// Timer compacto del panel de ronda. La UI esta aqui; la fuente de verdad del reloj
// y su sincronizacion viven en timerStore.
import { useEffect, useRef } from 'react'
import { useTimerStore, useTimerData } from '../store/timerStore'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { CircularTimer } from './CircularTimer'

// Temporizador embebido dentro de la ronda del admin.
interface TimerProps {
  tournamentId: string
  variant?: 'default' | 'compact'
}

export function Timer({ tournamentId, variant = 'default' }: TimerProps) {
  const tournament = useTournamentsStore(
    s => s.tournaments.find(t => t.id === tournamentId)
  )

  // Extraer funciones y estado como valores primitivos, no el objeto store entero
  const initTimer   = useTimerStore(s => s.initTimer)
  const startTimer  = useTimerStore(s => s.startTimer)
  const pauseTimer  = useTimerStore(s => s.pauseTimer)
  const resumeTimer = useTimerStore(s => s.resumeTimer)
  const resetTimer  = useTimerStore(s => s.resetTimer)

  // Solo el status como string primitivo, no el objeto timerData entero
  const timerStatus = useTimerStore(s => s.timers[tournamentId]?.status ?? 'idle')

  const { allResultsIn } = useSwissPairings(tournamentId)
  const timerData = useTimerData(tournamentId)

  const duration     = tournament?.timerDuration ?? 50 * 60
  const currentRound = tournament?.currentRound ?? 0

  // Ref para evitar que el efecto de ronda se dispare en el montaje inicial
  const prevRoundRef = useRef<number>(currentRound)

  // 1. Inicializar timer solo al montar (o si cambia el torneo)
  useEffect(() => {
    initTimer(tournamentId, duration)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  // 2. Arrancar al cambiar de ronda (no en el montaje inicial)
  useEffect(() => {
    if (currentRound > 0 && currentRound !== prevRoundRef.current) {
      prevRoundRef.current = currentRound
      resetTimer(tournamentId, duration)
      startTimer(tournamentId)
    }
  }, [currentRound, tournamentId, duration, resetTimer, startTimer])

  // 3. Pausar cuando entran todos los resultados
  //    timerStatus es un string primitivo → React compara por valor, no por referencia
  useEffect(() => {
    if (allResultsIn && timerStatus === 'running') {
      pauseTimer(tournamentId)
    }
  }, [allResultsIn, timerStatus, tournamentId, pauseTimer])

  if (!timerData) return null

  const { formatted, status, secondsLeft, isWarning, isDanger, isFinished } = timerData

  const progress = secondsLeft / duration
  const isCompact = variant === 'compact'

  const barColor = (() => {
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
    if (isFinished)                          return '¡Tiempo agotado!'
    if (status === 'idle')                   return 'Esperando inicio'
    if (status === 'paused' && allResultsIn) return 'Todos los resultados introducidos'
    if (status === 'paused')                 return 'Pausado'
    if (isDanger)                            return 'Menos de 5 minutos'
    if (isWarning)                           return 'Menos de 10 minutos'
    return 'Ronda en curso'
  })()

  return (
    <div className={isCompact ? 'timer-panel timer-panel-compact' : 'timer-panel'} style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${isFinished || isDanger ? 'var(--color-border-danger)' : 'var(--color-border-tertiary)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: isCompact ? '10px 12px' : '1.25rem 1.5rem',
      marginBottom: isCompact ? 0 : '1.5rem',
      transition: 'border-color .3s',
      display: isCompact ? 'grid' : undefined,
      gridTemplateColumns: isCompact ? '74px minmax(0, 1fr)' : undefined,
      alignItems: isCompact ? 'center' : undefined,
      justifyContent: isCompact ? 'start' : undefined,
      gap: isCompact ? '12px' : undefined,
      width: isCompact ? 'min(100%, 318px)' : undefined,
      minHeight: isCompact ? '86px' : undefined,
    }}>

      <div style={{ marginBottom: isCompact ? 0 : '1rem' }}>
        <CircularTimer
          formatted={formatted}
          progress={progress}
          color={barColor}
          trackColor={isFinished || isDanger ? 'var(--color-danger-bg)' : isWarning ? 'var(--color-warning-bg)' : 'var(--color-success-bg)'}
          glowColor={isFinished || isDanger ? 'rgba(255, 107, 122, 0.16)' : isWarning ? 'rgba(255, 209, 102, 0.12)' : 'rgba(31, 122, 255, 0.14)'}
          size={isCompact ? '70px' : 'min(72vw, 260px)'}
          strokeWidth={isCompact ? 5 : 6.5}
          label={isCompact ? undefined : statusLabel}
          labelColor={timeColor === 'var(--color-text-primary)' ? 'var(--color-text-secondary)' : timeColor}
          timeColor={timeColor}
          timeSize={isCompact ? '16px' : 'clamp(36px, 11vw, 56px)'}
        />
      </div>

      {/* Controles */}
      <div style={{ display: 'grid', gap: isCompact ? '7px' : '10px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: isCompact ? '6px' : '8px', justifyContent: isCompact ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
          {status === 'idle' && (
            <ControlBtn onClick={() => startTimer(tournamentId)} icon="ti-player-play" label="Iniciar" compact={isCompact} />
          )}
          {status === 'running' && (
            <ControlBtn onClick={() => pauseTimer(tournamentId)} icon="ti-player-pause" label="Pausar" compact={isCompact} />
          )}
          {status === 'paused' && (
            <ControlBtn onClick={() => resumeTimer(tournamentId)} icon="ti-player-play" label="Continuar" compact={isCompact} />
          )}
          {isFinished && (
            <ControlBtn onClick={() => {}} icon="ti-clock-off" label="Tiempo agotado" disabled color="var(--color-text-danger)" compact={isCompact} />
          )}

          <ControlBtn
            onClick={() => resetTimer(tournamentId, duration)}
            icon="ti-rotate"
            label="Reiniciar"
            disabled={status === 'idle'}
            compact={isCompact}
          />
        </div>
        {isCompact && (
          <div style={{
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            color: timeColor === 'var(--color-text-primary)' ? 'var(--color-text-secondary)' : timeColor,
            fontSize: '11px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}>
            <i className="ti ti-bell" aria-hidden="true" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface ControlBtnProps {
  onClick: () => void
  icon: string
  label: string
  disabled?: boolean
  color?: string
  compact?: boolean
}

function ControlBtn({ onClick, icon, label, disabled, color, compact }: ControlBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: compact ? '6px 9px' : '7px 14px',
        fontSize: compact ? '12px' : '13px',
        minHeight: compact ? '32px' : undefined,
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--color-background-primary)',
        color: color ?? 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      } as React.CSSProperties}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
      {label}
    </button>
  )
}
