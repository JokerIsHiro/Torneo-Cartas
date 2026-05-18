import { useTournamentStore } from '../store/tournamentsStore'
import { Standings } from '../components/Standings'

export function Results() {
  const { resetTournament, name } = useTournamentStore()

  return (
    <div>
      {/* Cabecera de fin de torneo */}
      <div style={{
        textAlign: 'center',
        padding: '1.5rem 1rem',
        marginBottom: '1rem',
        background: 'var(--color-background-primary)',
        border: '0.5px solid #FAC775',
        borderRadius: 'var(--border-radius-lg)',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {name}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Torneo finalizado
        </div>
      </div>

      <Standings />

      <button
        onClick={() => {
          if (confirm('¿Seguro que quieres reiniciar? Se perderán todos los datos del torneo.')) {
            resetTournament()
          }
        }}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '13px',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          marginTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <i className="ti ti-refresh" aria-hidden="true" />
        Nuevo torneo
      </button>
    </div>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '1rem 1.25rem',
  marginBottom: '.75rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.75rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}