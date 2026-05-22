import type { FirebaseOptions } from 'firebase/app'

export const DEFAULT_ADMIN_AUTH_EMAIL = 'admin@subterra-torneos.local'

export const ADMIN_AUTH_EMAIL = DEFAULT_ADMIN_AUTH_EMAIL

const envFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyC0rwyO8n3LzK69M1ncX3LhPZUL212Z9WU',
  authDomain: 'subterra-torneos.firebaseapp.com',
  projectId: 'subterra-torneos',
  storageBucket: 'subterra-torneos.firebasestorage.app',
  messagingSenderId: '26410482236',
  appId: '1:26410482236:web:626107fb183b0e827fe139',
} satisfies FirebaseOptions

export const hasEnvFirebaseConfig = Object.values(envFirebaseConfig).every(Boolean)

export const bundledFirebaseConfig: FirebaseOptions = hasEnvFirebaseConfig
  ? envFirebaseConfig
  : defaultFirebaseConfig

export const hasBundledFirebaseConfig = Object.values(bundledFirebaseConfig).every(Boolean)
