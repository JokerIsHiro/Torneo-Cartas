import { useTournamentStore } from './store/tournamentStore'
import { Setup } from './pages/Setup'
import { Round } from './pages/Round'
import { Results } from './pages/Results'
import { Standings } from './components/Standings'

export default function App() {
  const { status, name, currentRound, resetTournament } = useTournamentStore()

  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      padding: '1.5rem 1rem',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>

      {/* Barra superior */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
            <i className="ti ti-cards" aria-hidden="true" /> {status === 'setup' ? 'Nuevo torneo' : name}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {status === 'setup'  && 'Configura jugadores y opciones'}
            {status === 'active' && `Ronda ${currentRound} en curso · Sistema Swiss`}
            {status === 'finished' && 'Torneo finalizado'}
          </p>
        </div>

        {/* Indicador de estado */}
        <StatusBadge status={status} />
      </div>

      {/* Navegación — solo visible durante el torneo */}
      {status === 'active' && (
        <NavTabs />
      )}

      {/* Contenido por estado */}
      {status === 'setup'    && <Setup />}
      {status === 'active'   && <ActiveView />}
      {status === 'finished' && <Results />}

    </div>
  )
}

// ─── Vista activa con pestañas internas ───────────────────────────────────────

function ActiveView() {
  const activeTab = useActiveTab()

  return (
    <>
      {activeTab === 'ronda'         && <Round />}
      {activeTab === 'clasificacion' && <Standings />}
    </>
  )
}

// ─── Estado de pestaña activa (mini estado local sin librería extra) ──────────

type ActiveTab = 'ronda' | 'clasificacion'

let _activeTab: ActiveTab = 'ronda'
let _listeners: Array<() => void> = []

function setActiveTab(tab: ActiveTab) {
  _activeTab = tab
  _listeners.forEach(fn => fn())
}

function useActiveTab(): ActiveTab {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const listener = () => forceRender(n => n + 1)
    _listeners.push(listener)
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  return _activeTab
}

function NavTabs() {
  const tab = useActiveTab()

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-md)',
      overflow: 'hidden',
      marginBottom: '1.5rem',
    }}>
      {([
        { id: 'ronda',         label: 'Ronda',          icon: 'ti-swords' },
        { id: 'clasificacion', label: 'Clasificación',  icon: 'ti-trophy' },
      ] as const).map((t, i) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            background: tab === t.id ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
            border: 'none',
            borderRight: i === 0 ? '0.5px solid var(--color-border-tertiary)' : 'none',
            cursor: 'pointer',
            color: tab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: tab === t.id ? 500 : 400,
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
  )
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'setup' | 'active' | 'finished' }) {
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

// imports necesarios al inicio del archivo
import { useState, useEffect } from 'react'