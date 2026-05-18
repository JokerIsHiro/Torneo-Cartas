import { useEffect, useRef } from 'react'
import { useTimerStore, useTimerData } from '../store/timerStore'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

interface TimerProps {
  tournamentId: string
}

export function Timer({ tournamentId }: TimerProps) {
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

  const progressPercent = (secondsLeft / duration) * 100

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
    if (isFinished)                          return '¡Tiempo agotado!'
    if (status === 'idle')                   return 'Esperando inicio'
    if (status === 'paused' && allResultsIn) return 'Todos los resultados introducidos'
    if (status === 'paused')                 return 'Pausado'
    if (isDanger)                            return 'Menos de 5 minutos'
    if (isWarning)                           return 'Menos de 10 minutos'
    return 'Ronda en curso'
  })()

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${isFinished || isDanger ? '#F7C1C1' : 'var(--color-border-tertiary)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '1.25rem 1.5rem',
      marginBottom: '1.5rem',
      transition: 'border-color .3s',
    }}>

      {/* Tiempo */}
      <div style={{
        fontSize: '52px',
        fontWeight: 500,
        fontFamily: 'var(--font-mono, monospace)',
        color: timeColor,
        letterSpacing: '2px',
        lineHeight: 1,
        textAlign: 'center',
        transition: 'color .3s',
      }}>
        {formatted}
      </div>

      {/* Estado */}
      <div style={{
        fontSize: '12px',
        color: timeColor === 'var(--color-text-primary)' ? 'var(--color-text-secondary)' : timeColor,
        textAlign: 'center',
        marginTop: '6px',
        marginBottom: '1rem',
        transition: 'color .3s',
      }}>
        {statusLabel}
      </div>

      {/* Barra de progreso invertida */}
      <div style={{
        height: '6px',
        background: 'var(--color-background-secondary)',
        borderRadius: '3px',
        marginBottom: '1rem',
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

      {/* Controles */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>

        {status === 'idle' && (
          <ControlBtn onClick={() => startTimer(tournamentId)} icon="ti-player-play" label="Iniciar" />
        )}
        {status === 'running' && (
          <ControlBtn onClick={() => pauseTimer(tournamentId)} icon="ti-player-pause" label="Pausar" />
        )}
        {status === 'paused' && (
          <ControlBtn onClick={() => resumeTimer(tournamentId)} icon="ti-player-play" label="Continuar" />
        )}
        {isFinished && (
          <ControlBtn onClick={() => {}} icon="ti-clock-off" label="Tiempo agotado" disabled color="#A32D2D" />
        )}

        <ControlBtn
          onClick={() => resetTimer(tournamentId, duration)}
          icon="ti-rotate"
          label="Reiniciar"
          disabled={status === 'idle'}
        />
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
}

function ControlBtn({ onClick, icon, label, disabled, color }: ControlBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 14px',
        fontSize: '13px',
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
