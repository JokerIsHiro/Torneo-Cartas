import { useEffect } from 'react'
import {
  ensureFirebaseAuth,
  hasFirebaseConfig,
  subscribeToRemoteTournaments,
} from '../services/firebase'
import { useTournamentsStore } from '../store/tournamentsStore'

export function useFirebaseSync() {
  useEffect(() => {
    let isMounted = true
    const store = useTournamentsStore.getState()

    if (!hasFirebaseConfig()) {
      store.setSyncEnabled(false)
      store.setSyncLoaded(true)
      return
    }

    localStorage.removeItem('torneos-storage')
    store.setSyncEnabled(true)
    store.setSyncLoaded(false)

    let unsubscribe: (() => void) | null = null

    void ensureFirebaseAuth()
      .then(() => {
        if (!isMounted) return

        unsubscribe = subscribeToRemoteTournaments(
          remoteTournaments => {
            useTournamentsStore.getState().setRemoteTournaments(remoteTournaments)
          },
          error => {
            console.error('No se ha podido escuchar Firebase', error)
            useTournamentsStore.getState().setSyncEnabled(false)
            useTournamentsStore.getState().setSyncLoaded(true)
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
      unsubscribe?.()
      useTournamentsStore.getState().setSyncEnabled(false)
      useTournamentsStore.getState().setSyncLoaded(false)
    }
  }, [])
}
