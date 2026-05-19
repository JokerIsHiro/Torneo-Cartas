import { create } from 'zustand'
import { useTournamentsStore } from './tournamentsStore'
import { playTimerFinishedSound } from '../utils/timerSound'

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

type SyncedTimerState = Omit<TimerState, 'intervalId'>

export const TIMER_SYNC_KEY = 'torneos-timers-sync'

const defaultTimer = (durationSeconds: number): TimerState => ({
  secondsLeft: durationSeconds,
  status: 'idle',
  intervalId: null,
})

function publishTimers(timers: Record<string, TimerState>) {
  const syncedTimers = Object.fromEntries(
    Object.entries(timers).map(([id, timer]) => [
      id,
      {
        secondsLeft: timer.secondsLeft,
        status: timer.status,
      } satisfies SyncedTimerState,
    ])
  )

  localStorage.setItem(TIMER_SYNC_KEY, JSON.stringify(syncedTimers))
}

function readSyncedTimers(value?: string | null): Record<string, SyncedTimerState> {
  try {
    return JSON.parse(value ?? localStorage.getItem(TIMER_SYNC_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function commitTimers(timers: Record<string, TimerState>) {
  useTimerStore.setState({ timers })
  publishTimers(timers)
}

function tickTimer(tournamentId: string) {
  const current = useTimerStore.getState().timers[tournamentId]
  if (!current) return

  if (current.secondsLeft <= 1) {
    if (current.intervalId) clearInterval(current.intervalId)
    useTournamentsStore.getState().applyTimeoutToUnfinished(tournamentId)
    playTimerFinishedSound()
    commitTimers({
      ...useTimerStore.getState().timers,
      [tournamentId]: { ...current, secondsLeft: 0, status: 'finished', intervalId: null },
    })
    return
  }

  commitTimers({
    ...useTimerStore.getState().timers,
    [tournamentId]: { ...current, secondsLeft: current.secondsLeft - 1 },
  })
}

export function syncTimersFromStorage(value?: string | null) {
  const syncedTimers = readSyncedTimers(value)

  useTimerStore.setState(s => ({
    timers: Object.fromEntries(
      Object.entries(syncedTimers).map(([id, timer]) => {
        const existing = s.timers[id]

        if (existing?.intervalId && timer.status !== 'running') {
          clearInterval(existing.intervalId)
        }

        return [
          id,
          {
            ...timer,
            intervalId: existing?.status === 'running' ? existing.intervalId : null,
          },
        ]
      })
    ),
  }))
}

export const useTimerStore = create<TimerStore>((_, get) => ({
  timers: {},

  initTimer: (tournamentId, durationSeconds) => {
    const existing = get().timers[tournamentId]
    if (existing) return

    const syncedTimer = readSyncedTimers()[tournamentId]
    const timer = syncedTimer ? { ...syncedTimer, intervalId: null } : defaultTimer(durationSeconds)
    commitTimers({ ...get().timers, [tournamentId]: timer })
  },

  startTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'idle') return

    const intervalId = setInterval(() => tickTimer(tournamentId), 1000)
    commitTimers({
      ...get().timers,
      [tournamentId]: { ...timer, status: 'running', intervalId },
    })
  },

  pauseTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'running') return
    if (timer.intervalId) clearInterval(timer.intervalId)

    commitTimers({
      ...get().timers,
      [tournamentId]: { ...timer, status: 'paused', intervalId: null },
    })
  },

  resumeTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'paused') return

    const intervalId = setInterval(() => tickTimer(tournamentId), 1000)
    commitTimers({
      ...get().timers,
      [tournamentId]: { ...timer, status: 'running', intervalId },
    })
  },

  resetTimer: (tournamentId, durationSeconds) => {
    const timer = get().timers[tournamentId]
    if (timer?.intervalId) clearInterval(timer.intervalId)

    commitTimers({
      ...get().timers,
      [tournamentId]: defaultTimer(durationSeconds),
    })
  },

  getTimer: (tournamentId) => {
    return get().timers[tournamentId] ?? null
  },
}))

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
