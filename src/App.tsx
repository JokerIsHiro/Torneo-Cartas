// Orquestador principal de la app: decide la vista segun la URL, controla el acceso admin
// y conecta sincronizacion global. Si anades una pantalla nueva, registra aqui su ruta.
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTournamentsStore } from './store/tournamentsStore'
import { syncTimersFromStorage, TIMER_SYNC_KEY, useTimerStore } from './store/timerStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'
import { SnapshotPanel } from './components/SnapshotPanel'
import type { Tournament } from './types/tournament'
import { unlockTimerSound } from './utils/timerSound'
import { useFirebaseSync } from './hooks/useFirebaseSync'
import { signInAdmin, signOutAdmin } from './services/firebase'
import { ADMIN_AUTH_EMAIL } from './config/appConfig'

// Componente raiz. Decide que vista se muestra segun la ruta de la URL
// y conecta la sincronizacion entre pestanas.
type AppRoute = 'admin' | 'proyeccion' | 'temporizadores' | 'inscripcion' | 'qr' | 'deckbuilder'
type AdminTab = string
type TournamentInnerTab = 'ronda' | 'organizar' | 'clasificacion'

const ADMIN_SESSION_KEY = 'torneo-admin-session'
const ADMIN_SESSION_VALUE = 'firebase-admin-v1'
const MIN_ADMIN_CODE_LENGTH = 8
const RANKING_TAB_ID = '__ranking__'

const ProjectorView = lazy(() => import('./components/ProjectorView').then(module => ({ default: module.ProjectorView })))
const TimersView = lazy(() => import('./components/TimersView').then(module => ({ default: module.TimersView })))
const RegistrationView = lazy(() => import('./components/RegistrationView').then(module => ({ default: module.RegistrationView })))
const DeckBuilderView = lazy(() => import('./components/DeckBuilderView').then(module => ({ default: module.DeckBuilderView })))
const LocalRanking = lazy(() => import('./components/LocalRanking').then(module => ({ default: module.LocalRanking })))

const routePaths: Record<AppRoute, string> = {
  admin: '/',
  proyeccion: '/proyeccion',
  temporizadores: '/temporizadores',
  inscripcion: '/inscripcion',
  qr: '/qr',
  deckbuilder: '/deckbuilder',
}

function getRouteFromPath(): AppRoute {
  if (window.location.pathname.startsWith('/proyeccion')) return 'proyeccion'
  if (window.location.pathname.startsWith('/temporizadores')) return 'temporizadores'
  if (window.location.pathname.startsWith('/inscripcion')) return 'inscripcion'
  if (window.location.pathname.startsWith('/qr')) return 'qr'
  if (window.location.pathname.startsWith('/deckbuilder')) return 'deckbuilder'
  return 'admin'
}

function setRoute(route: AppRoute) {
  const targetPath = routePaths[route]
  if (window.location.pathname !== targetPath) {
    window.history.pushState(null, '', targetPath)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [route, setRouteState] = useState<AppRoute>(getRouteFromPath)
  const [activeTab, setActiveTab] = useState<AdminTab>('')
  const [innerTab, setInnerTab] = useState<Record<string, TournamentInnerTab>>({})
  const [adminUnlocked, setAdminUnlocked] = useState(() => localStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_SESSION_VALUE)
  const isMobileDevice = useIsMobileDevice()
  useFirebaseSync()

  const tournaments = useTournamentsStore(s => s.tournaments)
  const syncEnabled = useTournamentsStore(s => s.syncEnabled)
  const syncLoaded = useTournamentsStore(s => s.syncLoaded)
  const createTournament = useTournamentsStore(s => s.createTournament)
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const initTimer = useTimerStore(s => s.initTimer)

  useEffect(() => {
    if (window.location.hash.startsWith('#/')) {
      const legacyPath = window.location.hash.slice(1)
      window.history.replaceState(null, '', legacyPath)
    }

    function handleRouteChange() {
      setRouteState(getRouteFromPath())
    }

    handleRouteChange()
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  useEffect(() => {
    function handleStorageSync(event: StorageEvent) {
      if (event.key === TIMER_SYNC_KEY) {
        syncTimersFromStorage(event.newValue)
      }
    }

    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [])

  useEffect(() => {
    function handleFirstInteraction() {
      void unlockTimerSound()
    }

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
    window.addEventListener('keydown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  function getInnerTab(id: string): TournamentInnerTab {
    return innerTab[id] ?? 'ronda'
  }

  function setInnerTabFor(id: string, tab: TournamentInnerTab) {
    setInnerTab(prev => ({ ...prev, [id]: tab }))
  }

  function handleCreateTournament() {
    if (syncEnabled && !syncLoaded) return
    const id = createTournament()
    initTimer(id, 50 * 60)
    setActiveTab(id)
    setRoute('admin')
  }

  function handleDeleteTournament(t: Tournament) {
    if (confirm(`Eliminar "${t.name}"?`)) {
      deleteTournament(t.id)
      if (selectedTab === t.id) {
        const next = tournaments.find(candidate => candidate.id !== t.id)
        setActiveTab(next?.id ?? '')
      }
    }
  }

  function openPublicTab(target: 'proyeccion' | 'temporizadores') {
    const url = new URL(routePaths[target], window.location.origin)
    if (target === 'proyeccion' && selectedTab) url.searchParams.set('torneo', selectedTab)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  async function handleAdminLogin(code: string) {
    if (!ADMIN_AUTH_EMAIL) return false
    await signInAdmin(code.trim())
    localStorage.setItem(ADMIN_SESSION_KEY, ADMIN_SESSION_VALUE)
    setAdminUnlocked(true)
    return true
  }

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    setAdminUnlocked(false)
    void signOutAdmin()
    setRoute('admin')
  }

  const selectedTab = activeTab || tournaments[0]?.id || ''
  const activeTournament = tournaments.find(t => t.id === selectedTab)
  const rankingSelected = selectedTab === RANKING_TAB_ID
  const mobileBlocked = isMobileDevice && route !== 'inscripcion'
  const adminLocked = (route === 'admin' || route === 'deckbuilder') && !adminUnlocked

  return (
    <div className="app-shell">
      {!mobileBlocked && <div className="top-bar">
        <div className="brand-block">
          <img
            src="/subterra-logo.jpg"
            alt="Subterra TCG - Juegos de mesa"
          />
        </div>

        {route === 'admin' && !adminLocked && (
          <>
            {tournaments.map(t => (
              <TopTab
                key={t.id}
                label={t.name}
                active={selectedTab === t.id}
                status={t.status}
                onClick={() => setActiveTab(t.id)}
                onClose={() => handleDeleteTournament(t)}
              />
            ))}

            <TopTab
              label="Ranking local"
              active={rankingSelected}
              onClick={() => setActiveTab(RANKING_TAB_ID)}
            />

            {tournaments.length > 0 && (
              <div className="admin-public-actions">
                <button
                  onClick={() => openPublicTab('proyeccion')}
                  className="projector-open-button"
                  title="Abre la pantalla publica de mesas y rivales"
                >
                  <i className="ti ti-external-link" aria-hidden="true" />
                  Pantalla de emparejamientos
                </button>

                <button
                  onClick={() => openPublicTab('temporizadores')}
                  className="projector-open-button"
                  title="Abre los relojes de ronda en otra pestana"
                >
                  <i className="ti ti-clock" aria-hidden="true" />
                  Pantalla de temporizadores
                </button>
              </div>
            )}

            <button
              onClick={handleCreateTournament}
              disabled={syncEnabled && !syncLoaded}
              className="new-tournament-button"
              title="Crea un torneo vacio para configurar"
            >
              <i className="ti ti-plus" aria-hidden="true" />
              Crear nuevo torneo
            </button>

            <button
              onClick={handleAdminLogout}
              className="projector-open-button"
              title="Cierra la sesion de administracion de la tienda"
            >
              <i className="ti ti-logout" aria-hidden="true" />
              Cerrar sesion
            </button>
          </>
        )}

        {route !== 'admin' && route !== 'inscripcion' && (
          <div className="public-nav">
            {route === 'proyeccion' && (
              <button onClick={() => setRoute('temporizadores')} title="Ver relojes de ronda">
                <i className="ti ti-clock" aria-hidden="true" />
                Ir a temporizadores
              </button>
            )}
            {route === 'temporizadores' && (
              <button onClick={() => setRoute('proyeccion')} title="Ver mesas y rivales">
                <i className="ti ti-swords" aria-hidden="true" />
                Ir a emparejamientos
              </button>
            )}
          </div>
        )}
      </div>}

      <main className={route !== 'admin' ? 'main-content projector-content' : 'main-content'}>
        {mobileBlocked && <MobilePlayerOnly />}
        {!mobileBlocked && adminLocked && <AdminLogin onSubmit={handleAdminLogin} configured={Boolean(ADMIN_AUTH_EMAIL)} />}
        {!mobileBlocked && route === 'proyeccion' && <LazyView><ProjectorView /></LazyView>}
        {!mobileBlocked && route === 'temporizadores' && <LazyView><TimersView /></LazyView>}
        {route === 'inscripcion' && <LazyView><RegistrationView /></LazyView>}
        {!mobileBlocked && route === 'qr' && <QrView />}
        {!mobileBlocked && route === 'deckbuilder' && !adminLocked && <LazyView><DeckBuilderView /></LazyView>}

        {!mobileBlocked && route === 'admin' && !adminLocked && rankingSelected && <LazyView><LocalRanking /></LazyView>}

        {!mobileBlocked && route === 'admin' && !adminLocked && activeTournament && !rankingSelected && (
          <TournamentView
            tournament={activeTournament}
            innerTab={getInnerTab(activeTournament.id)}
            onInnerTabChange={tab => setInnerTabFor(activeTournament.id, tab)}
          />
        )}

        {!mobileBlocked && route === 'admin' && !adminLocked && syncEnabled && !syncLoaded && (
          <div className="empty-state">
            <i className="ti ti-loader-2" aria-hidden="true" />
            <div>Cargando torneos...</div>
          </div>
        )}

        {!mobileBlocked && route === 'admin' && !adminLocked && syncLoaded && !activeTournament && !rankingSelected && (
          <div className="empty-state">
            <i className="ti ti-trophy-off" aria-hidden="true" />
            <div>No hay torneos creados</div>
            <button onClick={handleCreateTournament} className="empty-action-button" title="Empieza configurando un torneo nuevo">
              <i className="ti ti-plus" aria-hidden="true" />
              Crear primer torneo
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function LazyView({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      {children}
    </Suspense>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <i className="ti ti-loader-2" aria-hidden="true" />
      <span>Cargando...</span>
    </div>
  )
}

function AdminLogin({ onSubmit, configured }: { onSubmit: (code: string) => Promise<boolean>; configured: boolean }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!configured) {
      setError('Falta configurar la clave de acceso.')
      return
    }
    if (code.trim().length < MIN_ADMIN_CODE_LENGTH) {
      setError(`Usa una clave de al menos ${MIN_ADMIN_CODE_LENGTH} caracteres.`)
      return
    }
    setIsSubmitting(true)
    try {
      if (!await onSubmit(code)) {
        setError('Clave incorrecta.')
        setCode('')
        return
      }
      setError('')
    } catch {
      setError('Clave incorrecta.')
      setCode('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="admin-login-card" onSubmit={handleSubmit}>
      <i className="ti ti-lock" aria-hidden="true" />
      <h1>Acceso de tienda</h1>
      <p>Introduce la clave para gestionar torneos.</p>
      <input
        value={code}
        onChange={event => {
          setCode(event.target.value)
          setError('')
        }}
        type="password"
        autoComplete="current-password"
        placeholder="Clave segura"
        aria-label="Clave de acceso"
        autoFocus
      />
      <button type="submit" disabled={!configured || !code.trim() || isSubmitting}>
        <i className={`ti ${isSubmitting ? 'ti-loader-2' : 'ti-login-2'}`} aria-hidden="true" />
        {isSubmitting ? 'Comprobando...' : 'Entrar'}
      </button>
      {error && <div className="registration-feedback error">{error}</div>}
      {!configured && (
        <div className="registration-feedback error">
          Define VITE_ADMIN_AUTH_EMAIL antes de publicar.
        </div>
      )}
    </form>
  )
}

function QrView() {
  // Pantalla publica y limpia para proyectar o abrir el QR de inscripcion en otra pestana.
  const tournamentId = new URLSearchParams(window.location.search).get('torneo') ?? ''
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const isMobileDevice = useIsMobileDevice()
  const link = (() => {
    const publicUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const url = new URL('/inscripcion', publicUrl)
    if (tournamentId) url.searchParams.set('torneo', tournamentId)
    return url.toString()
  })()

  useEffect(() => {
    if (!isMobileDevice || !tournamentId) return
    window.location.replace(link)
  }, [isMobileDevice, link, tournamentId])

  return (
    <div className="qr-display-page">
      <div>
        <img src="/subterra-logo.jpg" alt="Subterra TCG" />
        <h1>{tournament?.name ?? 'Inscripcion al torneo'}</h1>
        <p>Escanea para apuntarte</p>
      </div>
      <div className="qr-display-box">
        <RegistrationQr value={link} />
      </div>
    </div>
  )
}

function useIsMobileDevice() {
  // Bloquea herramientas de tienda en moviles y tablets; quedan solo para jugadores.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1180px), (pointer: coarse)').matches)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1180px), (pointer: coarse)')
    function handleChange() {
      setIsMobile(query.matches)
    }

    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}

function MobilePlayerOnly() {
  return (
    <div className="mobile-player-only">
      <img src="/subterra-logo.jpg" alt="Subterra TCG" />
      <h1>Acceso de jugadores</h1>
      <p>En movil solo esta disponible la inscripcion y el emparejamiento personal desde el enlace o QR del torneo.</p>
    </div>
  )
}

function RegistrationQr({ value }: { value: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={520}
      level="M"
      marginSize={4}
      bgColor="#ffffff"
      fgColor="#05070c"
    />
  )
}

interface TournamentViewProps {
  tournament: Tournament
  innerTab: TournamentInnerTab
  onInnerTabChange: (tab: TournamentInnerTab) => void
}

function TournamentView({ tournament, innerTab, onInnerTabChange }: TournamentViewProps) {
  const { id, status } = tournament
  const tournamentFormatLabel = getTournamentFormatLabel(tournament)

  return (
    <div>
      <div className="tournament-header">
        <div>
          <h2>{tournament.name}</h2>
          <p>
            {status === 'setup' && 'Configura el torneo antes de iniciar'}
            {status === 'active' && `Ronda ${tournament.currentRound} en curso - ${tournamentFormatLabel}`}
            {status === 'finished' && 'Torneo finalizado'}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'active' && (
        <div className="segmented-tabs">
          {([
            { id: 'ronda', label: 'Ronda', icon: 'ti-swords' },
            { id: 'organizar', label: 'Organizar', icon: 'ti-arrows-shuffle' },
            { id: 'clasificacion', label: 'Clasificación', icon: 'ti-trophy' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => onInnerTabChange(t.id)}
              className={innerTab === t.id ? 'active' : ''}
            >
              <i className={`ti ${t.icon}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {status === 'setup' && <Setup tournamentId={id} />}
      {status === 'active' && innerTab === 'ronda' && <Round tournamentId={id} mode="results" />}
      {status === 'active' && innerTab === 'organizar' && <Round tournamentId={id} mode="organize" />}
      {status === 'active' && innerTab === 'clasificacion' && <Standings tournamentId={id} />}
      {status === 'finished' && <Results tournamentId={id} />}
      <SnapshotPanel tournamentId={id} />
    </div>
  )
}

interface TopTabProps {
  label: string
  active: boolean
  status?: Tournament['status']
  onClick: () => void
  onClose?: () => void
}

function TopTab({ label, active, status, onClick, onClose }: TopTabProps) {
  const dotColor = (() => {
    if (status === 'active') return 'var(--color-accent-secondary)'
    if (status === 'finished') return 'var(--color-text-warning)'
    return 'transparent'
  })()

  return (
    <div
      onClick={onClick}
      className={active ? 'top-tab active' : 'top-tab'}
    >
      {status && <span className="status-dot" style={{ background: dotColor }} />}
      <span>{label}</span>

      {onClose && (
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          aria-label="Cerrar torneo"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function getTournamentFormatLabel(tournament: Tournament) {
  const teamLabel = tournament.teamMode === '2v2'
    ? '2vs2'
    : tournament.teamMode === '3v3'
      ? '3vs3'
      : 'Normal'
  const phaseLabel = tournament.phaseMode === 'swiss-top'
    ? `Suizo + Top ${tournament.topCut ?? 8}`
    : 'Suizo'
  return `${teamLabel} - ${phaseLabel}`
}

function StatusBadge({ status }: { status: Tournament['status'] }) {
  const config = {
    setup: { label: 'Configuración', bg: 'var(--color-draw-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-primary)' },
    active: { label: 'En curso', bg: 'var(--color-success-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-success)' },
    finished: { label: 'Finalizado', bg: 'var(--color-warning-bg)', color: 'var(--color-text-warning)', border: 'var(--color-border-warning)' },
  }
  const c = config[status]

  return (
    <span className="status-badge" style={{
      background: c.bg,
      color: c.color,
      borderColor: c.border,
    }}>
      {c.label}
    </span>
  )
}
