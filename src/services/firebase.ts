import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Tournament } from '../types/tournament'
import type { SyncedTimerState } from '../store/timerStore'
import { ADMIN_AUTH_EMAIL, bundledFirebaseConfig, hasBundledFirebaseConfig } from '../config/appConfig'
import { getDefaultTiebreakerSystem } from '../utils/tiebreakers'

// Instancias lazy. Asi la app puede arrancar aunque falten variables y
// decidir en runtime si usa Firebase Hosting init.json o .env.local.
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let authPromise: Promise<User | null> | null = null
let runtimeConfigPromise: Promise<FirebaseOptions | null> | null = null
let authPersistencePromise: Promise<void> | null = null

export function hasFirebaseConfig() {
  return hasBundledFirebaseConfig || isFirebaseHosting()
}

function isFirebaseHosting() {
  return window.location.hostname.endsWith('.web.app') || window.location.hostname.endsWith('.firebaseapp.com')
}

async function getFirebaseConfig() {
  if (hasBundledFirebaseConfig) return bundledFirebaseConfig

  runtimeConfigPromise ??= fetch('/__/firebase/init.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() as Promise<FirebaseOptions> : null)
    .catch(() => null)

  return runtimeConfigPromise
}

async function getFirebaseApp() {
  if (!app) {
    const firebaseConfig = await getFirebaseConfig()
    if (!firebaseConfig) return null
    app = initializeApp(firebaseConfig)
  }
  return app
}

async function getFirebaseAuth() {
  const firebaseApp = await getFirebaseApp()
  if (!firebaseApp) return null
  if (!auth) {
    auth = getAuth(firebaseApp)
    // Mantiene la sesion aunque se recargue o se abra otra pestana del navegador.
    authPersistencePromise = setPersistence(auth, browserLocalPersistence)
  }
  await authPersistencePromise
  return auth
}

async function getDb() {
  const firebaseApp = await getFirebaseApp()
  if (!firebaseApp) return null
  if (!db) db = getFirestore(firebaseApp)
  return db
}

export async function ensureFirebaseAuth() {
  const firebaseAuth = await getFirebaseAuth()
  if (!firebaseAuth) return null
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  authPromise ??= signInAnonymously(firebaseAuth)
    .then(credential => credential.user)
    .finally(() => {
      authPromise = null
    })

  return authPromise
}

export async function signInAdmin(accessCode: string) {
  const firebaseAuth = await getFirebaseAuth()
  const adminEmail = ADMIN_AUTH_EMAIL
  if (!firebaseAuth || !adminEmail) return null
  const credential = await signInWithEmailAndPassword(firebaseAuth, adminEmail, accessCode)
  return credential.user
}

export async function signOutAdmin() {
  const firebaseAuth = await getFirebaseAuth()
  if (!firebaseAuth) return
  await signOut(firebaseAuth)
  await ensureFirebaseAuth()
}

export function getCurrentUserId() {
  return auth?.currentUser?.uid ?? null
}

export async function subscribeToRemoteTournaments(
  onTournaments: (tournaments: Tournament[]) => void,
  onError: (error: Error) => void
): Promise<Unsubscribe | null> {
  const firestore = await getDb()
  if (!firestore) return null

  return onSnapshot(
    collection(firestore, 'tournaments'),
    snapshot => {
      const tournaments = snapshot.docs
        .map(document => normalizeTournament({
          id: document.id,
          ...document.data(),
        }))
        .sort((a, b) => a.createdAt - b.createdAt)

      onTournaments(tournaments)
    },
    error => onError(error)
  )
}

export async function subscribeToRemoteTimers(
  onTimers: (timers: Record<string, SyncedTimerState>) => void,
  onError: (error: Error) => void
): Promise<Unsubscribe | null> {
  const firestore = await getDb()
  if (!firestore) return null

  return onSnapshot(
    collection(firestore, 'timers'),
    snapshot => {
      const timers = Object.fromEntries(
        snapshot.docs.map(document => [
          document.id,
          normalizeTimer(document.data()),
        ])
      )

      onTimers(timers)
    },
    error => onError(error)
  )
}

export async function saveRemoteTournament(tournament: Tournament) {
  const firestore = await getDb()
  if (!firestore) return
  const user = await ensureFirebaseAuth()
  await setDoc(doc(firestore, 'tournaments', tournament.id), {
    ...tournament,
    organizerUid: tournament.organizerUid ?? user?.uid,
  })
}

export async function deleteRemoteTournament(tournamentId: string) {
  const firestore = await getDb()
  if (!firestore) return
  await ensureFirebaseAuth()
  await deleteDoc(doc(firestore, 'tournaments', tournamentId))
  await deleteDoc(doc(firestore, 'timers', tournamentId))
}

export async function saveRemoteTimer(tournamentId: string, timer: SyncedTimerState) {
  const firestore = await getDb()
  if (!firestore) return
  await ensureFirebaseAuth()
  await setDoc(doc(firestore, 'timers', tournamentId), timer)
}

function normalizeTournament(data: Partial<Tournament> & { id: string }): Tournament {
  // Firestore puede tener documentos creados con versiones anteriores de la
  // app. Normalizar aqui mantiene el resto del codigo con tipos completos.
  return {
    id: data.id,
    organizerUid: data.organizerUid,
    name: data.name ?? 'Nuevo torneo',
    tcg: data.tcg ?? 'magic',
    magicFormat: data.magicFormat ?? 'pauper',
    teamMode: data.teamMode ?? 'solo',
    phaseMode: data.phaseMode ?? 'swiss',
    topCut: data.topCut ?? 8,
    players: (data.players ?? []).map(player => ({
      ...player,
      playerKind: player.playerKind ?? 'new',
      droppedAt: player.droppedAt ?? null,
      droppedRound: player.droppedRound ?? null,
    })),
    rounds: data.rounds ?? [],
    pendingResults: data.pendingResults ?? [],
    decklists: (data.decklists ?? []).map(deck => ({
      ...deck,
      archetype: deck.archetype ?? deck.name,
    })),
    snapshots: data.snapshots ?? [],
    currentRound: data.currentRound ?? 0,
    status: data.status ?? 'setup',
    timerDuration: data.timerDuration ?? 50 * 60,
    tiebreakerSystem: data.tiebreakerSystem ?? getDefaultTiebreakerSystem(data.tcg ?? 'magic'),
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt ?? data.createdAt ?? Date.now(),
  }
}

function normalizeTimer(data: Partial<SyncedTimerState>): SyncedTimerState {
  // Misma idea para temporizadores: cualquier campo antiguo o ausente vuelve
  // a un estado seguro.
  return {
    secondsLeft: data.secondsLeft ?? 50 * 60,
    status: data.status ?? 'idle',
    endsAt: data.endsAt ?? null,
    updatedAt: data.updatedAt ?? 0,
  }
}
