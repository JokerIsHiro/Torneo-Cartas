import { useState, useEffect, useRef, useCallback } from 'react'

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

interface UseTimerOptions {
  durationSeconds: number
  onFinish?: () => void  // callback cuando llega a cero
}

interface UseTimerReturn {
  secondsLeft: number
  status: TimerStatus
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  // Helpers de UI
  formatted: string        // "49:59"
  progress: number         // 0 a 1 (para una barra de progreso)
  isWarning: boolean       // true cuando quedan menos de 10 min
  isDanger: boolean        // true cuando quedan menos de 5 min
}

export function useTimer({ durationSeconds, onFinish }: UseTimerOptions): UseTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [status, setStatus] = useState<TimerStatus>('idle')

  // useRef para el callback: evita que el efecto se re-suscriba
  // cada vez que onFinish cambia de referencia
  const onFinishRef = useRef(onFinish)
  useEffect(() => { onFinishRef.current = onFinish }, [onFinish])

  // Ref para el intervalo
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    setSecondsLeft(prev => {
      if (prev <= 1) {
        clearTimer()
        setStatus('finished')
        onFinishRef.current?.()
        return 0
      }
      return prev - 1
    })
  }, [clearTimer])

  const start = useCallback(() => {
    if (status !== 'idle') return
    setStatus('running')
    intervalRef.current = setInterval(tick, 1000)
  }, [status, tick])

  const pause = useCallback(() => {
    if (status !== 'running') return
    clearTimer()
    setStatus('paused')
  }, [status, clearTimer])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    setStatus('running')
    intervalRef.current = setInterval(tick, 1000)
  }, [status, tick])

  const reset = useCallback(() => {
    clearTimer()
    setSecondsLeft(durationSeconds)
    setStatus('idle')
  }, [clearTimer, durationSeconds])

  // Limpiar al desmontar el componente
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  // Si durationSeconds cambia desde fuera (ej: el usuario ajusta el tiempo),
  // reiniciar el temporizador
  useEffect(() => {
    reset()
  }, [durationSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers de UI ───────────────────────────────────────────────────────

  const formatted = (() => {
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })()

  const progress = secondsLeft / durationSeconds  // 1 = lleno, 0 = vacío

  const isWarning = secondsLeft <= 10 * 60 && secondsLeft > 5 * 60
  const isDanger  = secondsLeft <= 5 * 60

  return {
    secondsLeft,
    status,
    start,
    pause,
    resume,
    reset,
    formatted,
    progress,
    isWarning,
    isDanger,
  }
}