import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { Standings } from '../components/Standings'

interface ResultsProps {
  tournamentId: string
}

export function Results({ tournamentId }: ResultsProps) {
  const { name, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return { name: t?.name ?? '', exists: !!t }
    })
  )
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)

  if (!exists) return null

  return (
    <div>
      <div style={{
        textAlign: 'center',
        padding: '1.5rem 1rem',
        marginBottom: '1rem',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-podium-gold)',
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

      <Standings tournamentId={tournamentId} />

      <button
        onClick={() => {
          if (confirm('¿Seguro que quieres eliminar este torneo?')) {
            deleteTournament(tournamentId)
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
        <i className="ti ti-trash" aria-hidden="true" /> Eliminar torneo
      </button>
    </div>
  )
}
