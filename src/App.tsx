// Orquestador principal de la app: decide la vista segun la URL, controla el acceso admin
// y conecta sincronizacion global. Si anades una pantalla nueva, registra aqui su ruta.
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTournamentsStore } from './store/tournamentsStore'
import { syncTimersFromStorage, TIMER_SYNC_KEY, useTimerData, useTimerStore } from './store/timerStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'
import { SnapshotPanel } from './components/SnapshotPanel'
import type { Tournament } from './types/tournament'
import { unlockTimerSound } from './utils/timerSound'
import { useFirebaseSync } from './hooks/useFirebaseSync'
import { useSwissPairings } from './hooks/useSwissPairings'
import { signInAdmin, signOutAdmin } from './services/firebase'
import { ADMIN_AUTH_EMAIL } from './config/appConfig'
import { FeedbackProvider } from './components/Feedback'
import { useFeedback } from './components/feedbackContext'

// Componente raiz. Decide que vista se muestra segun la ruta de la URL
// y conecta la sincronizacion entre pestanas.
type AppRoute = 'admin' | 'proyeccion' | 'temporizadores' | 'inscripcion' | 'jugador' | 'organizar' | 'qr' | 'deckbuilder'
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
  jugador: '/jugador',
  organizar: '/organizar',
  qr: '/qr',
  deckbuilder: '/deckbuilder',
}

function getRouteFromPath(): AppRoute {
  if (window.location.pathname.startsWith('/proyeccion')) return 'proyeccion'
  if (window.location.pathname.startsWith('/temporizadores')) return 'temporizadores'
  if (window.location.pathname.startsWith('/inscripcion')) return 'inscripcion'
  if (window.location.pathname.startsWith('/jugador')) return 'jugador'
  if (window.location.pathname.startsWith('/organizar')) return 'organizar'
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
  return (
    <FeedbackProvider>
      <AppContent />
    </FeedbackProvider>
  )
}

function AppContent() {
  const [route, setRouteState] = useState<AppRoute>(getRouteFromPath)
  const [activeTab, setActiveTab] = useState<AdminTab>('')
  const [innerTab, setInnerTab] = useState<Record<string, TournamentInnerTab>>({})
  const [adminUnlocked, setAdminUnlocked] = useState(() => localStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_SESSION_VALUE)
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false)
  const isMobileDevice = useIsMobileDevice()
  useFirebaseSync()

  const tournaments = useTournamentsStore(s => s.tournaments)
  const syncEnabled = useTournamentsStore(s => s.syncEnabled)
  const syncLoaded = useTournamentsStore(s => s.syncLoaded)
  const createTournament = useTournamentsStore(s => s.createTournament)
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const initTimer = useTimerStore(s => s.initTimer)
  const { confirm, notify } = useFeedback()

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
    setAdminDrawerOpen(false)
    notify({ tone: 'success', title: 'Torneo creado', message: 'Ya puedes configurarlo y anadir jugadores.' })
  }

  async function handleDeleteTournament(t: Tournament) {
    const accepted = await confirm({
      title: `Eliminar "${t.name}"`,
      message: 'Esta accion borrara el torneo y sus datos asociados.',
      confirmLabel: 'Eliminar torneo',
      tone: 'danger',
    })
    if (accepted) {
      deleteTournament(t.id)
      if (selectedTab === t.id) {
        const next = tournaments.find(candidate => candidate.id !== t.id)
        setActiveTab(next?.id ?? '')
      }
      notify({ tone: 'success', title: 'Torneo eliminado' })
    }
  }

  function openPublicTab(target: 'proyeccion' | 'temporizadores' | 'organizar') {
    const url = new URL(routePaths[target], window.location.origin)
    if ((target === 'proyeccion' || target === 'organizar') && selectedTab) url.searchParams.set('torneo', selectedTab)
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
    setAdminDrawerOpen(false)
    void signOutAdmin()
    setRoute('admin')
  }

  function selectAdminTab(tab: AdminTab) {
    setActiveTab(tab)
    setRoute('admin')
    setAdminDrawerOpen(false)
  }

  const selectedTab = activeTab || tournaments[0]?.id || ''
  const activeTournament = tournaments.find(t => t.id === selectedTab)
  const rankingSelected = selectedTab === RANKING_TAB_ID
  const mobileBlocked = isMobileDevice && route !== 'inscripcion' && route !== 'jugador' && route !== 'organizar'
  const adminLocked = (route === 'admin' || route === 'deckbuilder' || route === 'organizar') && !adminUnlocked

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
            <TournamentTopTabs
              tournaments={tournaments}
              selectedTab={selectedTab}
              rankingSelected={rankingSelected}
              onSelectTournament={selectAdminTab}
              onDeleteTournament={handleDeleteTournament}
            />

            <button
              className="admin-drawer-open"
              onClick={() => setAdminDrawerOpen(true)}
              aria-label="Abrir menu de administracion"
            >
              <i className="ti ti-menu-2" aria-hidden="true" />
              Menu
            </button>
          </>
        )}

        {route !== 'admin' && route !== 'inscripcion' && route !== 'jugador' && route !== 'organizar' && (
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

      {route === 'admin' && !adminLocked && (
        <AdminDrawer
          open={adminDrawerOpen}
          tournaments={tournaments}
          rankingSelected={rankingSelected}
          syncEnabled={syncEnabled}
          syncLoaded={syncLoaded}
          onClose={() => setAdminDrawerOpen(false)}
          onSelectRanking={() => selectAdminTab(RANKING_TAB_ID)}
          onCreateTournament={handleCreateTournament}
          onOpenPublicTab={openPublicTab}
          onLogout={handleAdminLogout}
        />
      )}

      <main className={route !== 'admin' ? 'main-content projector-content' : 'main-content'}>
        {mobileBlocked && <MobilePlayerOnly />}
        {!mobileBlocked && adminLocked && <AdminLogin onSubmit={handleAdminLogin} configured={Boolean(ADMIN_AUTH_EMAIL)} />}
        {!mobileBlocked && route === 'proyeccion' && <LazyView><ProjectorView /></LazyView>}
        {!mobileBlocked && route === 'temporizadores' && <LazyView><TimersView /></LazyView>}
        {route === 'inscripcion' && <LazyView><RegistrationView /></LazyView>}
        {route === 'jugador' && <LazyView><RegistrationView /></LazyView>}
        {!mobileBlocked && route === 'organizar' && !adminLocked && <OrganizerRoute />}
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

interface AdminDrawerProps {
  open: boolean
  tournaments: Tournament[]
  rankingSelected: boolean
  syncEnabled: boolean
  syncLoaded: boolean
  onClose: () => void
  onSelectRanking: () => void
  onCreateTournament: () => void
  onOpenPublicTab: (target: 'proyeccion' | 'temporizadores' | 'organizar') => void
  onLogout: () => void
}

function AdminDrawer({
  open,
  tournaments,
  rankingSelected,
  syncEnabled,
  syncLoaded,
  onClose,
  onSelectRanking,
  onCreateTournament,
  onOpenPublicTab,
  onLogout,
}: AdminDrawerProps) {
  if (!open) return null

  return (
    <div className="admin-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Menu de administracion" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <strong>Administracion</strong>
            <span>Torneos y pantallas de tienda</span>
          </div>
          <button onClick={onClose} aria-label="Cerrar menu">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <section>
          <div className="admin-drawer-section-title">Gestion</div>
          <div className="admin-drawer-list">
            <button className="admin-drawer-link" onClick={onCreateTournament} disabled={syncEnabled && !syncLoaded}>
              <i className="ti ti-plus" aria-hidden="true" />
              Crear torneo
            </button>
            <button className={rankingSelected ? 'admin-drawer-link active' : 'admin-drawer-link'} onClick={onSelectRanking}>
              <i className="ti ti-chart-bar" aria-hidden="true" />
              Ranking local
            </button>
          </div>
        </section>

        <section>
          <div className="admin-drawer-section-title">Pantallas</div>
          <div className="admin-drawer-actions">
            <button disabled={!tournaments.length} onClick={() => onOpenPublicTab('proyeccion')}>
              <i className="ti ti-external-link" aria-hidden="true" />
              Emparejamientos
            </button>
            <button disabled={!tournaments.length} onClick={() => onOpenPublicTab('temporizadores')}>
              <i className="ti ti-clock" aria-hidden="true" />
              Temporizadores
            </button>
            <button disabled={!tournaments.length} onClick={() => onOpenPublicTab('organizar')}>
              <i className="ti ti-arrows-shuffle" aria-hidden="true" />
              Organizar mesas
            </button>
          </div>
        </section>

        <footer>
          <button onClick={onLogout}>
            <i className="ti ti-logout" aria-hidden="true" />
            Cerrar sesion
          </button>
        </footer>
      </aside>
    </div>
  )
}

function OrganizerRoute() {
  const tournamentId = new URLSearchParams(window.location.search).get('torneo') ?? ''
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))

  if (!tournamentId || !tournament) {
    return (
      <div className="empty-state">
        <i className="ti ti-arrows-shuffle" aria-hidden="true" />
        <div>No se ha encontrado el torneo para organizar.</div>
      </div>
    )
  }

  if (tournament.status !== 'active') {
    return (
      <div className="empty-state">
        <i className="ti ti-lock" aria-hidden="true" />
        <div>Solo se pueden organizar emparejamientos con el torneo activo.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="tournament-header">
        <div>
          <h2>{tournament.name}</h2>
          <p>Organizar emparejamientos de la ronda {tournament.currentRound}</p>
        </div>
        <StatusBadge status={tournament.status} />
      </div>
      <Round tournamentId={tournament.id} mode="organize" />
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

function TournamentTopTabs({
  tournaments,
  selectedTab,
  rankingSelected,
  onSelectTournament,
  onDeleteTournament,
}: {
  tournaments: Tournament[]
  selectedTab: string
  rankingSelected: boolean
  onSelectTournament: (id: string) => void
  onDeleteTournament: (tournament: Tournament) => void
}) {
  return (
    <div className="top-tabs-scroll" aria-label="Torneos">
      {tournaments.length === 0 && (
        <div className="top-tabs-empty">
          <i className="ti ti-trophy-off" aria-hidden="true" />
          Sin torneos
        </div>
      )}

      {tournaments.map(tournament => (
        <div
          key={tournament.id}
          className={!rankingSelected && selectedTab === tournament.id ? 'top-tab active' : 'top-tab'}
          role="button"
          tabIndex={0}
          title={tournament.name}
          onClick={() => onSelectTournament(tournament.id)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelectTournament(tournament.id)
            }
          }}
        >
          <span className="status-dot" style={{ background: getStatusDotColor(tournament.status) }} />
          <span>{tournament.name}</span>
          <StatusBadge status={tournament.status} />
          <button
            onClick={event => {
              event.stopPropagation()
              onDeleteTournament(tournament)
            }}
            aria-label={`Eliminar ${tournament.name}`}
            title="Eliminar torneo"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      ))}
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
      <p>En movil solo esta disponible la inscripcion y el panel personal desde el enlace o QR del torneo.</p>
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
        <div className="tournament-header-actions">
          <SnapshotPanel tournamentId={id} />
          <StatusBadge status={status} />
        </div>
      </div>

      {status === 'active' && (
        <TournamentDayBar
          tournament={tournament}
          onInnerTabChange={onInnerTabChange}
        />
      )}

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
    </div>
  )
}

function TournamentDayBar({
  tournament,
  onInnerTabChange,
}: {
  tournament: Tournament
  onInnerTabChange: (tab: TournamentInnerTab) => void
}) {
  const nextRound = useTournamentsStore(s => s.nextRound)
  const finishTournament = useTournamentsStore(s => s.finishTournament)
  const timerData = useTimerData(tournament.id)
  const {
    allResultsIn,
    unfinishedCount,
    shouldFinish,
    phaseMode,
    topCut,
    roundSummaries,
  } = useSwissPairings(tournament.id)
  const currentSummary = roundSummaries.find(summary => summary.number === tournament.currentRound)
  const pendingCount = tournament.pendingResults?.length ?? 0
  const completedMatches = currentSummary?.matchesDone ?? 0
  const totalMatches = currentSummary?.matchesTotal ?? 0
  const canCloseRound = allResultsIn && pendingCount === 0
  const roundActionLabel = shouldFinish
    ? phaseMode === 'swiss-top' ? `Publicar Top ${topCut}` : 'Finalizar torneo'
    : 'Siguiente ronda'

  function openTournamentScreen(target: 'proyeccion' | 'temporizadores' | 'organizar') {
    const url = new URL(routePaths[target], window.location.origin)
    if (target === 'proyeccion' || target === 'organizar') {
      url.searchParams.set('torneo', tournament.id)
    }
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  function handleRoundAction() {
    if (!canCloseRound) return
    if (shouldFinish) {
      finishTournament(tournament.id)
      return
    }
    nextRound(tournament.id)
  }

  return (
    <section className="tournament-day-bar" aria-label="Estado rapido del torneo">
      <div className="day-bar-status">
        <span>Ronda {tournament.currentRound}</span>
        <strong>{timerData?.formatted ?? '--:--'}</strong>
        <em>{timerLabel(timerData?.status)}</em>
      </div>

      <div className="day-bar-metrics">
        <DayBarMetric label="Resultados" value={`${completedMatches}/${totalMatches}`} tone={allResultsIn ? 'ready' : 'default'} />
        <DayBarMetric label="Faltan" value={String(Math.max(0, unfinishedCount))} tone={unfinishedCount === 0 ? 'ready' : 'warning'} />
        <DayBarMetric label="Por confirmar" value={String(pendingCount)} tone={pendingCount === 0 ? 'ready' : 'warning'} />
      </div>

      <div className="day-bar-actions">
        <button type="button" onClick={() => openTournamentScreen('proyeccion')} title="Abre la pantalla publica de emparejamientos">
          <i className="ti ti-external-link" aria-hidden="true" />
          Emparejamientos
        </button>
        <button type="button" onClick={() => openTournamentScreen('temporizadores')} title="Abre la pantalla de temporizadores">
          <i className="ti ti-clock" aria-hidden="true" />
          Timer
        </button>
        <button type="button" onClick={() => {
          onInnerTabChange('organizar')
          openTournamentScreen('organizar')
        }} title="Abre la pantalla de organizar mesas">
          <i className="ti ti-arrows-shuffle" aria-hidden="true" />
          Organizar
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canCloseRound}
          onClick={handleRoundAction}
          title={canCloseRound ? roundActionLabel : 'Introduce o confirma todos los resultados primero'}
        >
          <i className={shouldFinish ? 'ti ti-trophy' : 'ti ti-arrow-right'} aria-hidden="true" />
          {roundActionLabel}
        </button>
      </div>
    </section>
  )
}

function DayBarMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'default' | 'ready' | 'warning'
}) {
  return (
    <div className={`day-bar-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function timerLabel(status?: string) {
  if (status === 'running') return 'en marcha'
  if (status === 'paused') return 'pausado'
  if (status === 'finished') return 'finalizado'
  return 'sin iniciar'
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

function getStatusDotColor(status: Tournament['status']) {
  if (status === 'active') return 'var(--color-accent-secondary)'
  if (status === 'finished') return 'var(--color-text-warning)'
  return 'var(--color-accent-primary)'
}
