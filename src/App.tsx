import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTournamentsStore } from './store/tournamentsStore'
import { syncTimersFromStorage, TIMER_SYNC_KEY, useTimerStore } from './store/timerStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'
import { ProjectorView } from './components/ProjectorView'
import { TimersView } from './components/TimersView'
import { RegistrationView } from './components/RegistrationView'
import type { Tournament } from './types/tournament'
import { unlockTimerSound } from './utils/timerSound'
import { useFirebaseSync } from './hooks/useFirebaseSync'
import { hasFirebaseConfig, signInAdmin, signOutAdmin, subscribeToAdminAuth } from './services/firebase'

// Componente raiz. Decide que vista se muestra segun la ruta de la URL
// y conecta la sincronizacion entre pestanas.
type AppRoute = 'admin' | 'proyeccion' | 'temporizadores' | 'inscripcion' | 'qr'
type AdminTab = string

const routePaths: Record<AppRoute, string> = {
  admin: '/',
  proyeccion: '/proyeccion',
  temporizadores: '/temporizadores',
  inscripcion: '/inscripcion',
  qr: '/qr',
}

function getRouteFromPath(): AppRoute {
  if (window.location.pathname.startsWith('/proyeccion')) return 'proyeccion'
  if (window.location.pathname.startsWith('/temporizadores')) return 'temporizadores'
  if (window.location.pathname.startsWith('/inscripcion')) return 'inscripcion'
  if (window.location.pathname.startsWith('/qr')) return 'qr'
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
  const [innerTab, setInnerTab] = useState<Record<string, 'ronda' | 'clasificacion'>>({})
  const [adminUser, setAdminUser] = useState<{ email: string | null } | null>(null)
  const [authChecked, setAuthChecked] = useState(() => !hasFirebaseConfig())
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
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    if (!hasFirebaseConfig()) return

    void subscribeToAdminAuth(user => {
      if (!isMounted) return
      setAdminUser(user ? { email: user.email } : null)
      setAuthChecked(true)
    }).then(nextUnsubscribe => {
      unsubscribe = nextUnsubscribe
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
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

  function getInnerTab(id: string): 'ronda' | 'clasificacion' {
    return innerTab[id] ?? 'ronda'
  }

  function setInnerTabFor(id: string, tab: 'ronda' | 'clasificacion') {
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

  const selectedTab = activeTab || tournaments[0]?.id || ''
  const activeTournament = tournaments.find(t => t.id === selectedTab)
  // Estados de acceso privado: las pantallas publicas siguen abiertas, solo bloqueamos admin.
  const adminPending = route === 'admin' && hasFirebaseConfig() && !authChecked
  const adminLocked = route === 'admin' && hasFirebaseConfig() && authChecked && !adminUser
  const adminUnlocked = route === 'admin' && !adminPending && !adminLocked

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand-block">
          <img
            src="/subterra-logo.jpg"
            alt="Subterra TCG - Juegos de mesa"
          />
        </div>

        {adminUnlocked && (
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

            {tournaments.length > 0 && (
              <div className="admin-public-actions">
                <button
                  onClick={() => openPublicTab('proyeccion')}
                  className="projector-open-button"
                  title="Abrir emparejamientos en otra pestaña"
                >
                  <i className="ti ti-external-link" aria-hidden="true" />
                  Emparejamientos
                </button>

                <button
                  onClick={() => openPublicTab('temporizadores')}
                  className="projector-open-button"
                  title="Abrir temporizadores en otra pestaña"
                >
                  <i className="ti ti-clock" aria-hidden="true" />
                  Temporizadores
                </button>
              </div>
            )}

            <button
              onClick={() => void signOutAdmin()}
              className="new-tournament-button"
              title={adminUser?.email ?? 'Sesion de administrador'}
            >
              <i className="ti ti-logout" aria-hidden="true" />
              Salir
            </button>

            <button
              onClick={handleCreateTournament}
              disabled={syncEnabled && !syncLoaded}
              className="new-tournament-button"
            >
              <i className="ti ti-plus" aria-hidden="true" />
              Nuevo torneo
            </button>
          </>
        )}

        {route !== 'admin' && route !== 'inscripcion' && (
          <div className="public-nav">
            {route === 'proyeccion' && (
              <button onClick={() => setRoute('temporizadores')}>
                <i className="ti ti-clock" aria-hidden="true" />
                Temporizadores
              </button>
            )}
            {route === 'temporizadores' && (
              <button onClick={() => setRoute('proyeccion')}>
                <i className="ti ti-swords" aria-hidden="true" />
                Emparejamientos
              </button>
            )}
          </div>
        )}
      </div>

      <main className={route !== 'admin' ? 'main-content projector-content' : 'main-content'}>
        {route === 'proyeccion' && <ProjectorView />}
        {route === 'temporizadores' && <TimersView />}
        {route === 'inscripcion' && <RegistrationView />}
        {route === 'qr' && <QrView />}

        {adminPending && (
          <div className="empty-state">
            <i className="ti ti-loader-2" aria-hidden="true" />
            <div>Comprobando administrador...</div>
          </div>
        )}

        {adminLocked && <AdminLogin />}

        {adminUnlocked && activeTournament && (
          <TournamentView
            tournament={activeTournament}
            innerTab={getInnerTab(activeTournament.id)}
            onInnerTabChange={tab => setInnerTabFor(activeTournament.id, tab)}
          />
        )}

        {adminUnlocked && syncEnabled && !syncLoaded && (
          <div className="empty-state">
            <i className="ti ti-loader-2" aria-hidden="true" />
            <div>Cargando torneos...</div>
          </div>
        )}

        {adminUnlocked && syncLoaded && !activeTournament && (
          <div className="empty-state">
            <i className="ti ti-trophy-off" aria-hidden="true" />
            <div>No hay torneos creados</div>
            <button onClick={handleCreateTournament} className="empty-action-button">
              <i className="ti ti-plus" aria-hidden="true" />
              Nuevo torneo
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function AdminLogin() {
  // Formulario minimo para entrar como organizador sin exponer controles de torneo.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInAdmin(email.trim(), password)
    } catch {
      setError('No se ha podido iniciar sesion. Revisa email y contrasena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="admin-login-card" onSubmit={handleSubmit}>
      <i className="ti ti-lock" aria-hidden="true" />
      <h1>Administrador</h1>
      <p>Acceso privado para gestionar torneos.</p>
      <input
        value={email}
        onChange={event => setEmail(event.target.value)}
        type="email"
        placeholder="Email"
        autoComplete="email"
      />
      <input
        value={password}
        onChange={event => setPassword(event.target.value)}
        type="password"
        placeholder="Contrasena"
        autoComplete="current-password"
      />
      <button disabled={loading || !email.trim() || !password}>
        <i className="ti ti-login" aria-hidden="true" />
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      {error && <div className="registration-feedback error">{error}</div>}
    </form>
  )
}

function QrView() {
  // Pantalla publica y limpia para proyectar o abrir el QR de inscripcion en otra pestana.
  const tournamentId = new URLSearchParams(window.location.search).get('torneo') ?? ''
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const link = (() => {
    const url = new URL('/inscripcion', window.location.origin)
    if (tournamentId) url.searchParams.set('torneo', tournamentId)
    return url.toString()
  })()

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
  innerTab: 'ronda' | 'clasificacion'
  onInnerTabChange: (tab: 'ronda' | 'clasificacion') => void
}

function TournamentView({ tournament, innerTab, onInnerTabChange }: TournamentViewProps) {
  const { id, status } = tournament

  return (
    <div>
      <div className="tournament-header">
        <div>
          <h2>{tournament.name}</h2>
          <p>
            {status === 'setup' && 'Configura el torneo antes de iniciar'}
            {status === 'active' && `Ronda ${tournament.currentRound} en curso · Swiss`}
            {status === 'finished' && 'Torneo finalizado'}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'active' && (
        <div className="segmented-tabs">
          {([
            { id: 'ronda', label: 'Ronda', icon: 'ti-swords' },
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
      {status === 'active' && innerTab === 'ronda' && <Round tournamentId={id} />}
      {status === 'active' && innerTab === 'clasificacion' && <Standings tournamentId={id} />}
      {status === 'finished' && <Results tournamentId={id} />}
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
