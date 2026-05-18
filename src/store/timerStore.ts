import { create } from 'zustand'
import { useTournamentsStore } from './tournamentsStore'

interface TimerState {
  secondsLeft: number
  status: 'idle' | 'running' | 'paused' | 'finished'
  intervalId: ReturnType<typeof setInterval> | null
}

interface TimerStore {
  timers: Record<string, TimerState>

  initTimer: (tournamentId: string, durationSeconds: number) => void
  startTimer: (tournamentId: string) => void
  pauseTimer: (tournamentId: string) => void
  resumeTimer: (tournamentId: string) => void
  resetTimer: (tournamentId: string, durationSeconds: number) => void
  getTimer: (tournamentId: string) => TimerState | null
}

const defaultTimer = (durationSeconds: number): TimerState => ({
  secondsLeft: durationSeconds,
  status: 'idle',
  intervalId: null,
})

export const useTimerStore = create<TimerStore>((set, get) => ({
  timers: {},

  initTimer: (tournamentId, durationSeconds) => {
    const existing = get().timers[tournamentId]
    if (existing) return  // ya inicializado, no sobreescribir

    set(s => ({
      timers: { ...s.timers, [tournamentId]: defaultTimer(durationSeconds) },
    }))
  },

  startTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'idle') return

    const intervalId = setInterval(() => {
      const current = get().timers[tournamentId]
      if (!current) return

      if (current.secondsLeft <= 1) {
        clearInterval(current.intervalId!)

        // Aplicar timeout automático a partidas sin resultado
        useTournamentsStore.getState().applyTimeoutToUnfinished(tournamentId)

        set(s => ({
          timers: {
            ...s.timers,
            [tournamentId]: { ...s.timers[tournamentId], secondsLeft: 0, status: 'finished', intervalId: null },
          },
        }))
        return
      }

      set(s => ({
        timers: {
          ...s.timers,
          [tournamentId]: { ...s.timers[tournamentId], secondsLeft: s.timers[tournamentId].secondsLeft - 1 },
        },
      }))
    }, 1000)

    set(s => ({
      timers: { ...s.timers, [tournamentId]: { ...s.timers[tournamentId], status: 'running', intervalId } },
    }))
  },

  pauseTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'running') return
    if (timer.intervalId) clearInterval(timer.intervalId)

    set(s => ({
      timers: { ...s.timers, [tournamentId]: { ...s.timers[tournamentId], status: 'paused', intervalId: null } },
    }))
  },

  resumeTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'paused') return

    const intervalId = setInterval(() => {
      const current = get().timers[tournamentId]
      if (!current) return

      if (current.secondsLeft <= 1) {
        clearInterval(current.intervalId!)
        useTournamentsStore.getState().applyTimeoutToUnfinished(tournamentId)
        set(s => ({
          timers: {
            ...s.timers,
            [tournamentId]: { ...s.timers[tournamentId], secondsLeft: 0, status: 'finished', intervalId: null },
          },
        }))
        return
      }

      set(s => ({
        timers: {
          ...s.timers,
          [tournamentId]: { ...s.timers[tournamentId], secondsLeft: s.timers[tournamentId].secondsLeft - 1 },
        },
      }))
    }, 1000)

    set(s => ({
      timers: { ...s.timers, [tournamentId]: { ...s.timers[tournamentId], status: 'running', intervalId } },
    }))
  },

  resetTimer: (tournamentId, durationSeconds) => {
    const timer = get().timers[tournamentId]
    if (timer?.intervalId) clearInterval(timer.intervalId)

    set(s => ({
      timers: { ...s.timers, [tournamentId]: defaultTimer(durationSeconds) },
    }))
  },

  getTimer: (tournamentId) => {
    return get().timers[tournamentId] ?? null
  },
}))

// Helper para derivar datos de UI sin suscribirse al store entero
export function useTimerData(tournamentId: string) {
  const timer = useTimerStore(s => s.timers[tournamentId])
  if (!timer) return null

  const { secondsLeft, status } = timer
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  return {
    secondsLeft,
    status,
    formatted,
    isWarning: secondsLeft <= 10 * 60 && secondsLeft > 5 * 60,
    isDanger: secondsLeft <= 5 * 60,
    isFinished: status === 'finished',
  }
}