import { useEffect, useState } from 'react'
import { useTournamentsStore } from './store/tournamentsStore'
import { useTimerStore } from './store/timerStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'
import { ProjectorView } from './components/ProjectorView'
import { TimersView } from './components/TimersView'
import { RegistrationView } from './components/RegistrationView'
import type { Tournament } from './types/tournament'

type AppRoute = 'admin' | 'proyeccion' | 'temporizadores' | 'inscripcion'
type AdminTab = string

function getRouteFromHash(): AppRoute {
  if (window.location.hash.startsWith('#/proyeccion')) return 'proyeccion'
  if (window.location.hash.startsWith('#/temporizadores')) return 'temporizadores'
  if (window.location.hash.startsWith('#/inscripcion')) return 'inscripcion'
  return 'admin'
}

function setRoute(route: AppRoute) {
  window.location.hash = `#/${route}`
}

export default function App() {
  const [hydrated, setHydrated] = useState(false)
  const [route, setRouteState] = useState<AppRoute>(getRouteFromHash)
  const [activeTab, setActiveTab] = useState<AdminTab>('')
  const [innerTab, setInnerTab] = useState<Record<string, 'ronda' | 'clasificacion'>>({})

  const tournaments = useTournamentsStore(s => s.tournaments)
  const createTournament = useTournamentsStore(s => s.createTournament)
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const initTimer = useTimerStore(s => s.initTimer)

  useEffect(() => {
    if (!window.location.hash) setRoute('admin')

    function handleHashChange() {
      setRouteState(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (useTournamentsStore.persist.hasHydrated()) {
      const id = setTimeout(() => setHydrated(true), 0)
      return () => clearTimeout(id)
    }

    const unsub = useTournamentsStore.persist.onFinishHydration(() => {
      setHydrated(true)
      unsub()
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    function handleStorageSync(event: StorageEvent) {
      if (event.key !== 'torneos-storage') return
      void useTournamentsStore.persist.rehydrate()
    }

    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [])

  if (!hydrated) {
    return (
      <div className="loading-screen">
        <i className="ti ti-loader-2" aria-hidden="true" />
        Cargando...
      </div>
    )
  }

  function getInnerTab(id: string): 'ronda' | 'clasificacion' {
    return innerTab[id] ?? 'ronda'
  }

  function setInnerTabFor(id: string, tab: 'ronda' | 'clasificacion') {
    setInnerTab(prev => ({ ...prev, [id]: tab }))
  }

  function handleCreateTournament() {
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
    window.open(`${window.location.pathname}#/${target}`, '_blank', 'noopener,noreferrer')
  }

  const selectedTab = activeTab || tournaments[0]?.id || ''
  const activeTournament = tournaments.find(t => t.id === selectedTab)

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand-block">
          <img
            src="/subterra-logo.jpg"
            alt="Subterra TCG - Juegos de mesa"
          />
        </div>

        {route === 'admin' && (
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

            <button
              onClick={() => openPublicTab('proyeccion')}
              className="projector-open-button"
            >
              <i className="ti ti-external-link" aria-hidden="true" />
              Emparejamientos
            </button>

            <button
              onClick={() => openPublicTab('temporizadores')}
              className="projector-open-button"
            >
              <i className="ti ti-clock" aria-hidden="true" />
              Temporizadores
            </button>

            <button
              onClick={handleCreateTournament}
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

        {route === 'admin' && activeTournament && (
          <TournamentView
            tournament={activeTournament}
            innerTab={getInnerTab(activeTournament.id)}
            onInnerTabChange={tab => setInnerTabFor(activeTournament.id, tab)}
          />
        )}

        {route === 'admin' && !activeTournament && (
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
