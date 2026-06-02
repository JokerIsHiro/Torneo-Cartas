// Panel de snapshots del torneo. Usa este archivo para mostrar, crear o restaurar
// puntos de recuperacion antes de acciones peligrosas.
import { useMemo, useState } from 'react'
import { useTournamentsStore } from '../store/tournamentsStore'
import type { Player, TournamentSnapshot } from '../types/tournament'

interface SnapshotPanelProps {
  tournamentId: string
}

const EMPTY_SNAPSHOTS: TournamentSnapshot[] = []

export function SnapshotPanel({ tournamentId }: SnapshotPanelProps) {
  const tournament = useTournamentsStore(s => s.tournaments.find(t => t.id === tournamentId))
  const restoreSnapshot = useTournamentsStore(s => s.restoreSnapshot)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const snapshots = tournament?.snapshots ?? EMPTY_SNAPSHOTS
  const selectedSnapshot = useMemo(
    () => snapshots.find(snapshot => snapshot.id === selectedSnapshotId) ?? snapshots[0],
    [selectedSnapshotId, snapshots]
  )

  if (!tournament || snapshots.length === 0) return null

  return (
    <>
      <section className="snapshot-compact-panel">
        <button onClick={() => setIsOpen(true)} title="Abre el historial de estados guardados">
          <i className="ti ti-history" aria-hidden="true" />
          Restaurar
          <span>{snapshots.length}</span>
        </button>
      </section>

      {isOpen && selectedSnapshot && (
        <div className="snapshot-dialog-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div className="snapshot-dialog" role="dialog" aria-modal="true" aria-label="Restaurar torneo" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <strong>Restaurar torneo</strong>
                <span>Revisa el estado guardado antes de volver atras.</span>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Cerrar historial de restauracion">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </header>

            <div className="snapshot-dialog-body">
              <aside className="snapshot-dialog-list">
                {snapshots.map(snapshot => (
                  <button
                    key={snapshot.id}
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                    className={snapshot.id === selectedSnapshot.id ? 'active' : ''}
                  >
                    <strong>{snapshot.label}</strong>
                    <span>{formatDate(snapshot.createdAt)}</span>
                  </button>
                ))}
              </aside>

              <section className="snapshot-preview">
                <SnapshotPreview snapshot={selectedSnapshot} />
              </section>
            </div>

            <footer>
              <button onClick={() => setIsOpen(false)}>
                Cancelar
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Restaurar "${selectedSnapshot.label}"? Se guardara una copia del estado actual antes de volver atras.`)) {
                    restoreSnapshot(tournamentId, selectedSnapshot.id)
                    setIsOpen(false)
                  }
                }}
              >
                <i className="ti ti-restore" aria-hidden="true" />
                Restaurar este estado
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function SnapshotPreview({ snapshot }: { snapshot: TournamentSnapshot }) {
  const data = snapshot.data
  const currentRound = data.rounds.find(round => round.number === data.currentRound) ?? data.rounds.at(-1)
  const activePlayers = data.players.filter(player => !player.droppedAt)
  const droppedPlayers = data.players.length - activePlayers.length
  const pendingCount = data.pendingResults?.length ?? 0
  const deckCount = data.decklists?.length ?? 0

  return (
    <>
      <div className="snapshot-preview-header">
        <div>
          <strong>{snapshot.label}</strong>
          <span>{formatDate(snapshot.createdAt)}</span>
        </div>
        <em>{getStatusLabel(data.status)}</em>
      </div>

      <div className="snapshot-summary-grid">
        <PreviewStat label="Ronda" value={String(data.currentRound || '-')} />
        <PreviewStat label="Jugadores" value={String(data.players.length)} />
        <PreviewStat label="Activos" value={String(activePlayers.length)} />
        <PreviewStat label="Retirados" value={String(droppedPlayers)} />
        <PreviewStat label="Mesas" value={String(currentRound?.matches.length ?? 0)} />
        <PreviewStat label="Pendientes" value={String(pendingCount)} />
        <PreviewStat label="Mazos" value={String(deckCount)} />
        <PreviewStat label="Formato" value={data.phaseMode === 'swiss-top' ? `Suizo + Top ${data.topCut}` : 'Suizo'} />
      </div>

      {currentRound && (
        <div className="snapshot-match-preview">
          <strong>Mesas de la ronda {currentRound.number}</strong>
          {currentRound.matches.slice(0, 8).map(match => (
            <div key={match.id}>
              <span>Mesa {match.tableNumber}</span>
              <p>
                {getPlayerName(data.players, match.p1Id)}
                <em>vs</em>
                {match.p2Id === 'BYE' ? 'BYE' : getPlayerName(data.players, match.p2Id)}
              </p>
            </div>
          ))}
          {currentRound.matches.length > 8 && (
            <small>+{currentRound.matches.length - 8} mesas mas</small>
          )}
        </div>
      )}
    </>
  )
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getPlayerName(players: Pick<Player, 'id' | 'name'>[], playerId: string) {
  return players.find(player => player.id === playerId)?.name ?? 'Jugador'
}

function getStatusLabel(status: string) {
  if (status === 'setup') return 'Configuracion'
  if (status === 'active') return 'En curso'
  if (status === 'finished') return 'Finalizado'
  return status
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
