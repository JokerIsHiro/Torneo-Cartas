import { useEffect } from 'react'
import {
  ensureFirebaseAuth,
  hasFirebaseConfig,
  saveRemoteTournament,
  subscribeToRemoteTournaments,
} from '../services/firebase'
import { useTournamentsStore } from '../store/tournamentsStore'

export function useFirebaseSync() {
  useEffect(() => {
    let isMounted = true
    const store = useTournamentsStore.getState()

    if (!hasFirebaseConfig()) {
      store.setSyncEnabled(false)
      return
    }

    store.setSyncEnabled(true)

    let hasReceivedSnapshot = false
    let unsubscribe: (() => void) | null = null

    void ensureFirebaseAuth()
      .then(() => {
        if (!isMounted) return

        unsubscribe = subscribeToRemoteTournaments(
          remoteTournaments => {
            const localTournaments = useTournamentsStore.getState().tournaments

            if (!hasReceivedSnapshot && remoteTournaments.length === 0 && localTournaments.length > 0) {
              hasReceivedSnapshot = true
              localTournaments.forEach(tournament => {
                void saveRemoteTournament(tournament).catch(error => {
                  console.error('No se ha podido subir el torneo local a Firebase', error)
                })
              })
              return
            }

            hasReceivedSnapshot = true
            useTournamentsStore.getState().setRemoteTournaments(remoteTournaments)
          },
          error => {
            console.error('No se ha podido escuchar Firebase', error)
            useTournamentsStore.getState().setSyncEnabled(false)
          }
        )
      })
      .catch(error => {
        console.error('No se ha podido iniciar Firebase Auth', error)
        useTournamentsStore.getState().setSyncEnabled(false)
      })

    return () => {
      isMounted = false
      unsubscribe?.()
      useTournamentsStore.getState().setSyncEnabled(false)
    }
  }, [])
}
