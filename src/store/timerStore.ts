import { create } from 'zustand'
import { useTournamentsStore } from './tournamentsStore'
import { playTimerFinishedSound } from '../utils/timerSound'
import { saveRemoteTimer } from '../services/firebase'

// Store de temporizadores. Usa endsAt (hora real de fin) para evitar congelaciones
// cuando una pestana queda en segundo plano o se abre tarde.
interface TimerState {
  secondsLeft: number
  status: 'idle' | 'running' | 'paused' | 'finished'
  endsAt: number | null
  updatedAt: number
  intervalId: ReturnType<typeof setInterval> | null
}

interface TimerStore {
  timers: Record<string, TimerState>
  timersLoaded: boolean

  initTimer: (tournamentId: string, durationSeconds: number) => void
  startTimer: (tournamentId: string) => void
  pauseTimer: (tournamentId: string) => void
  resumeTimer: (tournamentId: string) => void
  resetTimer: (tournamentId: string, durationSeconds: number) => void
  getTimer: (tournamentId: string) => TimerState | null
  setRemoteTimers: (timers: Record<string, SyncedTimerState>) => void
  setTimersLoaded: (loaded: boolean) => void
}

export type SyncedTimerState = Omit<TimerState, 'intervalId'>

export const TIMER_SYNC_KEY = 'torneos-timers-sync'
const TIMER_TICK_MS = 1000

const defaultTimer = (durationSeconds: number, updatedAt = Date.now()): TimerState => ({
  secondsLeft: durationSeconds,
  status: 'idle',
  endsAt: null,
  updatedAt,
  intervalId: null,
})

function getSecondsLeft(timer: TimerState | SyncedTimerState) {
  // Si esta corriendo, calculamos contra la hora real de fin.
  // Esto evita que se congele si el navegador pausa intervalos.
  if (timer.status !== 'running' || !timer.endsAt) return timer.secondsLeft
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
}

function toSyncedTimer(timer: TimerState | SyncedTimerState): SyncedTimerState {
  return {
    secondsLeft: getSecondsLeft(timer),
    status: timer.status,
    endsAt: timer.endsAt,
    updatedAt: timer.updatedAt,
  }
}

function publishTimers(timers: Record<string, TimerState>) {
  // Publicamos una version serializable sin intervalId para que otras pestanas lean el timer.
  const syncedTimers = Object.fromEntries(
    Object.entries(timers).map(([id, timer]) => [id, toSyncedTimer(timer)])
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

function commitTimers(timers: Record<string, TimerState>, publish = true) {
  useTimerStore.setState({ timers })
  if (publish) publishTimers(timers)
}

function commitTimer(tournamentId: string, timer: TimerState, publishRemote = true) {
  const timers = { ...useTimerStore.getState().timers, [tournamentId]: timer }
  commitTimers(timers)

  if (publishRemote) {
    void saveRemoteTimer(tournamentId, toSyncedTimer(timer)).catch(error => {
      console.error('No se ha podido sincronizar el temporizador con Firebase', error)
    })
  }
}

function ensureTicker(tournamentId: string, timer: TimerState) {
  if (timer.status !== 'running') return null
  if (timer.intervalId) return timer.intervalId
  return setInterval(() => tickTimer(tournamentId), TIMER_TICK_MS)
}

function tickTimer(tournamentId: string) {
  // Tick unico del timer: actualiza segundos restantes o finaliza la ronda.
  const current = useTimerStore.getState().timers[tournamentId]
  if (!current || current.status !== 'running') return

  const secondsLeft = getSecondsLeft(current)

  if (secondsLeft <= 0) {
    if (current.intervalId) clearInterval(current.intervalId)
    const tournament = useTournamentsStore.getState().tournaments.find(t => t.id === tournamentId)
    // Solo YuGiOh recibe derrota automatica al terminar el tiempo.
    if (tournament?.tcg === 'yugioh') {
      useTournamentsStore.getState().applyTimeoutToUnfinished(tournamentId)
    }
    playTimerFinishedSound()
    commitTimer(tournamentId, {
      ...current,
      secondsLeft: 0,
      status: 'finished',
      endsAt: null,
      updatedAt: Date.now(),
      intervalId: null,
    })
    return
  }

  commitTimers({
    ...useTimerStore.getState().timers,
    [tournamentId]: { ...current, secondsLeft },
  }, false)
}

function hydrateSyncedTimers(syncedTimers: Record<string, SyncedTimerState>) {
  // Reconstruye timers recibidos desde otra pestana y activa ticker local si hace falta.
  useTimerStore.setState(s => ({
    timers: Object.fromEntries(
      Object.entries({ ...s.timers, ...syncedTimers }).map(([id, timer]) => {
        const existing = s.timers[id]
        const incoming = syncedTimers[id]
        const source = incoming && (!existing || incoming.updatedAt >= existing.updatedAt)
          ? incoming
          : existing ?? timer

        if (existing?.intervalId && source.status !== 'running') {
          clearInterval(existing.intervalId)
        }

        const nextTimer: TimerState = {
          ...source,
          secondsLeft: getSecondsLeft(source),
          intervalId: source.status === 'running' ? existing?.intervalId ?? null : null,
        }

        nextTimer.intervalId = ensureTicker(id, nextTimer)

        return [id, nextTimer]
      })
    ),
  }))
}

export function syncTimersFromStorage(value?: string | null) {
  hydrateSyncedTimers(readSyncedTimers(value))
}

export const useTimerStore = create<TimerStore>((_, get) => ({
  timers: {},
  timersLoaded: false,

  initTimer: (tournamentId, durationSeconds) => {
    const existing = get().timers[tournamentId]
    if (existing) {
      const intervalId = ensureTicker(tournamentId, existing)
      if (intervalId !== existing.intervalId) {
        commitTimers({ ...get().timers, [tournamentId]: { ...existing, intervalId } })
      }
      return
    }

    const syncedTimer = readSyncedTimers()[tournamentId]
    const timer: TimerState = syncedTimer
      ? { ...syncedTimer, secondsLeft: getSecondsLeft(syncedTimer), intervalId: null }
      : defaultTimer(durationSeconds, 0)
    timer.intervalId = ensureTicker(tournamentId, timer)

    if (syncedTimer) {
      commitTimer(tournamentId, timer, false)
    } else {
      commitTimers({ ...get().timers, [tournamentId]: timer }, false)
    }
  },

  startTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'idle') return

    const nextTimer: TimerState = {
      ...timer,
      status: 'running',
      endsAt: Date.now() + timer.secondsLeft * 1000,
      updatedAt: Date.now(),
      intervalId: null,
    }
    nextTimer.intervalId = ensureTicker(tournamentId, nextTimer)

    commitTimer(tournamentId, nextTimer)
  },

  pauseTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'running') return
    if (timer.intervalId) clearInterval(timer.intervalId)

    commitTimer(tournamentId, {
      ...timer,
      secondsLeft: getSecondsLeft(timer),
      status: 'paused',
      endsAt: null,
      updatedAt: Date.now(),
      intervalId: null,
    })
  },

  resumeTimer: (tournamentId) => {
    const timer = get().timers[tournamentId]
    if (!timer || timer.status !== 'paused') return

    const nextTimer: TimerState = {
      ...timer,
      status: 'running',
      endsAt: Date.now() + timer.secondsLeft * 1000,
      updatedAt: Date.now(),
      intervalId: null,
    }
    nextTimer.intervalId = ensureTicker(tournamentId, nextTimer)

    commitTimer(tournamentId, nextTimer)
  },

  resetTimer: (tournamentId, durationSeconds) => {
    const timer = get().timers[tournamentId]
    if (timer?.intervalId) clearInterval(timer.intervalId)

    commitTimer(tournamentId, defaultTimer(durationSeconds))
  },

  getTimer: (tournamentId) => {
    return get().timers[tournamentId] ?? null
  },

  setRemoteTimers: (timers) => {
    hydrateSyncedTimers(timers)
    useTimerStore.setState({ timersLoaded: true })
    publishTimers(useTimerStore.getState().timers)
  },

  setTimersLoaded: (loaded) => {
    useTimerStore.setState({ timersLoaded: loaded })
  },
}))

export function useTimerData(tournamentId: string) {
  const timer = useTimerStore(s => s.timers[tournamentId])
  if (!timer) return null

  const secondsLeft = getSecondsLeft(timer)
  const { status } = timer
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
