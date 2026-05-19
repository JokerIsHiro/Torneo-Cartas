import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let authPromise: Promise<User | null> | null = null

export function hasFirebaseConfig() {
  return isFirebaseConfigured
}

function getFirebaseApp() {
  if (!isFirebaseConfigured) return null
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

function getFirebaseAuth() {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!auth) auth = getAuth(firebaseApp)
  return auth
}

function getDb() {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!db) db = getFirestore(firebaseApp)
  return db
}

export async function ensureFirebaseAuth() {
  const firebaseAuth = getFirebaseAuth()
  if (!firebaseAuth) return null
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  authPromise ??= signInAnonymously(firebaseAuth)
    .then(credential => credential.user)
    .finally(() => {
      authPromise = null
    })

  return authPromise
}

export function getCurrentUserId() {
  return getFirebaseAuth()?.currentUser?.uid ?? null
}

export function subscribeToRemoteTournaments(
  onTournaments: (tournaments: Tournament[]) => void,
  onError: (error: Error) => void
): Unsubscribe | null {
  const firestore = getDb()
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

export async function saveRemoteTournament(tournament: Tournament) {
  const firestore = getDb()
  if (!firestore) return
  const user = await ensureFirebaseAuth()
  await setDoc(doc(firestore, 'tournaments', tournament.id), {
    ...tournament,
    organizerUid: tournament.organizerUid ?? user?.uid,
  })
}

export async function deleteRemoteTournament(tournamentId: string) {
  const firestore = getDb()
  if (!firestore) return
  await ensureFirebaseAuth()
  await deleteDoc(doc(firestore, 'tournaments', tournamentId))
}

function normalizeTournament(data: Partial<Tournament> & { id: string }): Tournament {
  return {
    id: data.id,
    organizerUid: data.organizerUid,
    name: data.name ?? 'Nuevo torneo',
    tcg: data.tcg ?? 'magic',
    players: data.players ?? [],
    rounds: data.rounds ?? [],
    pendingResults: data.pendingResults ?? [],
    currentRound: data.currentRound ?? 0,
    status: data.status ?? 'setup',
    timerDuration: data.timerDuration ?? 50 * 60,
    createdAt: data.createdAt ?? Date.now(),
  }
}
