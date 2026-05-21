import { useEffect } from 'react'
import {
  ensureFirebaseAuth,
  hasFirebaseConfig,
  subscribeToRemoteTimers,
  subscribeToRemoteTournaments,
} from '../services/firebase'
import { useTimerStore } from '../store/timerStore'
import { useTournamentsStore } from '../store/tournamentsStore'

// Conecta la app local con Firestore. Si Firebase no esta configurado,
// la UI queda cargada igualmente para evitar una pantalla bloqueada.
export function useFirebaseSync() {
  useEffect(() => {
    let isMounted = true
    const store = useTournamentsStore.getState()

    if (!hasFirebaseConfig()) {
      store.setSyncEnabled(false)
      store.setSyncLoaded(true)
      return
    }

    // Los torneos antiguos se guardaban en localStorage. Al activar Firebase,
    // eliminamos ese cache para que no compita con la fuente remota.
    localStorage.removeItem('torneos-storage')
    store.setSyncEnabled(true)
    store.setSyncLoaded(false)

    let unsubscribeTournaments: (() => void) | null = null
    let unsubscribeTimers: (() => void) | null = null

    void ensureFirebaseAuth()
      .then(async () => {
        if (!isMounted) return

        unsubscribeTournaments = await subscribeToRemoteTournaments(
          remoteTournaments => {
            useTournamentsStore.getState().setRemoteTournaments(remoteTournaments)
          },
          error => {
            console.error('No se ha podido escuchar Firebase', error)
            useTournamentsStore.getState().setSyncEnabled(false)
            useTournamentsStore.getState().setSyncLoaded(true)
          }
        )

        unsubscribeTimers = await subscribeToRemoteTimers(
          remoteTimers => {
            useTimerStore.getState().setRemoteTimers(remoteTimers)
          },
          error => {
            console.error('No se han podido escuchar los temporizadores de Firebase', error)
          }
        )
      })
      .catch(error => {
        console.error('No se ha podido iniciar Firebase Auth', error)
        useTournamentsStore.getState().setSyncEnabled(false)
        useTournamentsStore.getState().setSyncLoaded(true)
      })

    return () => {
      isMounted = false
      unsubscribeTournaments?.()
      unsubscribeTimers?.()
      useTournamentsStore.getState().setSyncEnabled(false)
      useTournamentsStore.getState().setSyncLoaded(false)
    }
  }, [])
}
