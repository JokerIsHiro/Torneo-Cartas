import { useTournamentsStore } from '../store/tournamentsStore'

interface SnapshotPanelProps {
  tournamentId: string
}

export function SnapshotPanel({ tournamentId }: SnapshotPanelProps) {
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const restoreSnapshot = useTournamentsStore(s => s.restoreSnapshot)
  const snapshots = tournament?.snapshots ?? []

  if (!tournament || snapshots.length === 0) return null

  return (
    <section className="admin-tool-panel">
      <header>
        <div>
          <strong>
            <i className="ti ti-history" aria-hidden="true" /> Restaurar torneo
          </strong>
          <span>Copias automaticas antes de cambios importantes</span>
        </div>
      </header>

      <div className="snapshot-list">
        {snapshots.map(snapshot => (
          <div key={snapshot.id} className="snapshot-row">
            <div>
              <strong>{snapshot.label}</strong>
              <span>{formatDate(snapshot.createdAt)}</span>
            </div>
            <button
              onClick={() => {
                if (confirm(`Restaurar "${snapshot.label}"? Se guardara una copia del estado actual antes de volver atras.`)) {
                  restoreSnapshot(tournamentId, snapshot.id)
                }
              }}
            >
              <i className="ti ti-restore" aria-hidden="true" />
              Restaurar
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
