import { useState, useEffect } from 'react'
import { useTournamentsStore } from './store/tournamentsStore'
import { useTimerStore } from './store/timerStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'
import { TimersView } from './components/TimersView'
import type { Tournament } from './types/tournament'

type GlobalTab = 'timers' | string

export default function App() {

  const [hydrated, setHydrated] = useState(() => useTournamentsStore.persist.hasHydrated())

  const tournaments = useTournamentsStore(s => s.tournaments)
  const createTournament = useTournamentsStore(s => s.createTournament)
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const initTimer = useTimerStore(s => s.initTimer)

  const [activeTab, setActiveTab] = useState<GlobalTab>('timers')
  const [innerTab, setInnerTab] = useState<Record<string, 'ronda' | 'clasificacion'>>({})

  useEffect(() => {
    // Esperar a que Zustand rehidrate desde localStorage
    if (useTournamentsStore.persist.hasHydrated()) {
      return
    }

    const unsub = useTournamentsStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return () => {
      unsub()
    }
  }, [])

    if(!hydrated) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-background-secondary)',
          color: 'var(--color-text-secondary)',
          fontSize: '13px',
          gap: '8px',
        }}>
          <i className="ti ti-loader-2" aria-hidden="true" style={{ fontSize: '18px' }} />
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
  }

  function handleDeleteTournament(t: Tournament) {
    if (confirm(`¿Eliminar "${t.name}"?`)) {
      deleteTournament(t.id)
      if (activeTab === t.id) setActiveTab('timers')
    }
  }

  const activeTournament = tournaments.find(t => t.id === activeTab)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-background-secondary)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* Barra de pestañas superior */}
      <div style={{
        background: 'var(--color-background-primary)',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>

        {/* Logo */}
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          padding: '12px 16px 12px 4px',
          borderRight: '0.5px solid var(--color-border-tertiary)',
          marginRight: '8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          <i className="ti ti-cards" aria-hidden="true" /> Torneos
        </div>

        {/* Pestaña temporizadores */}
        <TopTab
          label="⏱ Temporizadores"
          active={activeTab === 'timers'}
          onClick={() => setActiveTab('timers')}
        />

        {/* Una pestaña por torneo */}
        {tournaments.map(t => (
          <TopTab
            key={t.id}
            label={t.name}
            active={activeTab === t.id}
            status={t.status}
            onClick={() => setActiveTab(t.id)}
            onClose={() => handleDeleteTournament(t)}
          />
        ))}

        {/* Botón nuevo torneo */}
        <button
          onClick={handleCreateTournament}
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            padding: '6px 12px',
            fontSize: '12px',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            margin: '8px 0 8px 8px',
          }}
        >
          <i className="ti ti-plus" aria-hidden="true" /> Nuevo torneo
        </button>
      </div>

      {/* Contenido principal */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {activeTab === 'timers' && <TimersView />}
        {activeTournament && (
          <TournamentView
            tournament={activeTournament}
            innerTab={getInnerTab(activeTournament.id)}
            onInnerTabChange={tab => setInnerTabFor(activeTournament.id, tab)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Vista de un torneo ───────────────────────────────────────────────────────

interface TournamentViewProps {
  tournament: Tournament
  innerTab: 'ronda' | 'clasificacion'
  onInnerTabChange: (tab: 'ronda' | 'clasificacion') => void
}

function TournamentView({ tournament, innerTab, onInnerTabChange }: TournamentViewProps) {
  const { id, status } = tournament

  return (
    <div>
      {/* Cabecera */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
            {tournament.name}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {status === 'setup'    && 'Configura el torneo antes de iniciar'}
            {status === 'active'   && `Ronda ${tournament.currentRound} en curso · Swiss`}
            {status === 'finished' && 'Torneo finalizado'}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Pestañas internas — solo en active */}
      {status === 'active' && (
        <div style={{
          display: 'flex',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-md)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          {([
            { id: 'ronda',         label: 'Ronda',         icon: 'ti-swords' },
            { id: 'clasificacion', label: 'Clasificación', icon: 'ti-trophy' },
          ] as const).map((t, i) => (
            <button
              key={t.id}
              onClick={() => onInnerTabChange(t.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                background: innerTab === t.id
                  ? 'var(--color-background-secondary)'
                  : 'var(--color-background-primary)',
                border: 'none',
                borderRight: i === 0 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                cursor: 'pointer',
                color: innerTab === t.id
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                fontWeight: innerTab === t.id ? 500 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all .15s',
              }}
            >
              <i className={`ti ${t.icon}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Contenido */}
      {status === 'setup'    && <Setup tournamentId={id} />}
      {status === 'active'   && innerTab === 'ronda'         && <Round tournamentId={id} />}
      {status === 'active'   && innerTab === 'clasificacion' && <Standings tournamentId={id} />}
      {status === 'finished' && <Results tournamentId={id} />}
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

interface TopTabProps {
  label: string
  active: boolean
  status?: Tournament['status']
  onClick: () => void
  onClose?: () => void
}

function TopTab({ label, active, status, onClick, onClose }: TopTabProps) {
  const dotColor = (() => {
    if (status === 'active')   return '#1D9E75'
    if (status === 'finished') return '#854F0B'
    return 'transparent'
  })()

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 12px',
        height: '44px',
        borderBottom: active
          ? '2px solid var(--color-text-primary)'
          : '2px solid transparent',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'border-color .15s',
      }}
    >
      {status && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          transition: 'background .2s',
        }} />
      )}

      <span style={{
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        color: active
          ? 'var(--color-text-primary)'
          : 'var(--color-text-secondary)',
        maxWidth: '140px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color .15s',
      }}>
        {label}
      </span>

      {onClose && (
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            padding: 0,
            flexShrink: 0,
            opacity: active ? 1 : 0,
            transition: 'opacity .15s',
          }}
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
    setup:    { label: 'Configuración', bg: '#E6F1FB', color: '#0C447C', border: '#B5D4F4' },
    active:   { label: 'En curso',      bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
    finished: { label: 'Finalizado',    bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
  }
  const c = config[status]
  return (
    <span style={{
      fontSize: '11px',
      padding: '3px 10px',
      borderRadius: 'var(--border-radius-md)',
      background: c.bg,
      color: c.color,
      border: `0.5px solid ${c.border}`,
      fontWeight: 500,
    }}>
      {c.label}
    </span>
  )
}