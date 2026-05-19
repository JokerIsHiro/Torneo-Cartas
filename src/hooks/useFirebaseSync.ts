import { useEffect } from 'react'
import {
  ensureFirebaseAuth,
  hasFirebaseConfig,
  saveRemoteTournament,
  subscribeToRemoteTournaments,
} from '../services/firebase'
import { useTournamentsStore } from '../store/tournamentsStore'

export function useFirebaseSync(mode: 'admin' | 'public' = 'admin') {
  useEffect(() => {
    let isMounted = true
    const store = useTournamentsStore.getState()

    if (!hasFirebaseConfig()) {
      store.setSyncEnabled(false)
      store.setSyncLoaded(true)
      return
    }

    store.setSyncEnabled(true)
    store.setSyncLoaded(false)

    let hasReceivedSnapshot = false
    let unsubscribe: (() => void) | null = null

    void ensureFirebaseAuth()
      .then(() => {
        if (!isMounted) return

        unsubscribe = subscribeToRemoteTournaments(
          remoteTournaments => {
            const localTournaments = useTournamentsStore.getState().tournaments

            if (mode === 'admin' && !hasReceivedSnapshot && remoteTournaments.length === 0 && localTournaments.length > 0) {
              hasReceivedSnapshot = true
              localTournaments.forEach(tournament => {
                void saveRemoteTournament(tournament).catch(error => {
                  console.error('No se ha podido subir el torneo local a Firebase', error)
                })
              })
              return
            }

            hasReceivedSnapshot = true
            useTournamentsStore.getState().setRemoteTournaments(remoteTournaments, mode === 'admin')
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
  }, [mode])
}
