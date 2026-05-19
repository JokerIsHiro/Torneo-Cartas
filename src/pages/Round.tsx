import { useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { Timer } from '../components/Timer'
import { MatchCard } from '../components/MatchCard'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'
import type { PendingMatchResult, Tournament } from '../types/tournament'

// Pantalla de ronda activa: temporizador, emparejamientos, resultados y exports.
interface RoundProps {
  tournamentId: string
}

export function Round({ tournamentId }: RoundProps) {
  const nextRound       = useTournamentsStore(s => s.nextRound)
  const finishTournament = useTournamentsStore(s => s.finishTournament)
  const { currentRound, pendingResults, tournament } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        currentRound: t?.currentRound ?? 0,
        pendingResults: t?.pendingResults ?? [],
        tournament: t,
      }
    })
  )

  const {
    currentMatches,
    allResultsIn,
    unfinishedCount,
    isFinalRound,
    shouldFinish,
    roundSummaries,
  } = useSwissPairings(tournamentId)

  const { ref: roundExportRef, exportImage: exportRoundImage } = useExportImage()
  const { ref: standingsExportRef, exportImage: exportStandingsImage } = useExportImage()
  const currentSummary = roundSummaries.find(r => r.number === currentRound)
  const previousPendingCount = useRef(pendingResults.length)

  useEffect(() => {
    if (pendingResults.length > previousPendingCount.current) {
      void notifyOrganizer('Nuevo resultado pendiente', 'Un jugador ha enviado un resultado para confirmar.')
    }
    previousPendingCount.current = pendingResults.length
  }, [pendingResults.length])

  return (
    <div>
      <div style={exportHiddenStyle}>
        <RoundExport ref={roundExportRef} tournamentId={tournamentId} type="round" />
        <RoundExport ref={standingsExportRef} tournamentId={tournamentId} type="standings" />
      </div>

      <Timer tournamentId={tournamentId} />

      {tournament && pendingResults.length > 0 && (
        <PendingResultsPanel tournament={tournament} pendingResults={pendingResults} />
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            <i className="ti ti-swords" aria-hidden="true" /> Ronda {currentRound}
          </span>
          {isFinalRound && (
            <span style={{
              fontSize: '11px', padding: '2px 8px',
              borderRadius: 'var(--border-radius-md)',
              background: 'var(--color-draw-bg)', color: 'var(--color-accent-secondary)', border: '0.5px solid var(--color-border-primary)',
            }}>
              ronda final
            </span>
          )}
        </div>

        <div className="round-export-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {currentSummary?.matchesDone ?? 0}/{currentSummary?.matchesTotal ?? 0} resultados
          </span>
          <button
            onClick={() => exportRoundImage(`ronda-${currentRound}`)}
            style={exportButtonStyle}
          >
            <i className="ti ti-download" aria-hidden="true" /> Ronda
          </button>
          <button
            onClick={() => exportStandingsImage(`clasificacion-ronda-${currentRound}`)}
            style={exportButtonStyle}
          >
            <i className="ti ti-trophy" aria-hidden="true" /> Clasificación
          </button>
        </div>
      </div>

      {currentMatches.map(match => (
        <MatchCard key={match.id} match={match} tournamentId={tournamentId} />
      ))}

      {allResultsIn && (
        <div style={{ marginTop: '1rem' }}>
          {shouldFinish ? (
            <button onClick={() => finishTournament(tournamentId)} style={actionBtnStyle('var(--color-accent-secondary)', 'var(--color-border-success)')}>
              <i className="ti ti-trophy" aria-hidden="true" /> Finalizar torneo
            </button>
          ) : (
            <button onClick={() => nextRound(tournamentId)} style={actionBtnStyle()}>
              <i className="ti ti-arrow-right" aria-hidden="true" /> Nueva ronda →
            </button>
          )}
        </div>
      )}

      {!allResultsIn && unfinishedCount > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '10px 12px',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          <i className="ti ti-clock" aria-hidden="true" />
          {' '}Faltan {unfinishedCount} {unfinishedCount === 1 ? 'resultado' : 'resultados'} por introducir
        </div>
      )}
    </div>
  )
}

function PendingResultsPanel({
  tournament,
  pendingResults,
}: {
  tournament: Tournament
  pendingResults: PendingMatchResult[]
}) {
  const approvePendingResult = useTournamentsStore(s => s.approvePendingResult)
  const rejectPendingResult = useTournamentsStore(s => s.rejectPendingResult)

  function playerName(playerId: string) {
    return tournament.players.find(p => p.id === playerId)?.name ?? 'Jugador'
  }

  function resultText(pendingResult: PendingMatchResult) {
    const round = tournament.rounds.find(r => r.number === pendingResult.roundNumber)
    const match = round?.matches.find(m => m.id === pendingResult.matchId)
    if (!match) return 'Resultado enviado'
    const p1Name = playerName(match.p1Id)
    const p2Name = match.p2Id === 'BYE' ? 'BYE' : playerName(match.p2Id)
    if (pendingResult.result === 'draw') return `${playerName(pendingResult.playerId)} reporta empate`
    if (pendingResult.result === 'p1') return `${playerName(pendingResult.playerId)} reporta que gana ${p1Name}`
    if (pendingResult.result === 'p2') return `${playerName(pendingResult.playerId)} reporta que gana ${p2Name}`
    return `${playerName(pendingResult.playerId)} reporta tiempo agotado`
  }

  function tableText(pendingResult: PendingMatchResult) {
    const round = tournament.rounds.find(r => r.number === pendingResult.roundNumber)
    const match = round?.matches.find(m => m.id === pendingResult.matchId)
    return match ? `Ronda ${pendingResult.roundNumber} · Mesa ${match.tableNumber}` : `Ronda ${pendingResult.roundNumber}`
  }

  return (
    <section className="pending-results-panel">
      <header>
        <div>
          <strong>Resultados pendientes</strong>
          <span>{pendingResults.length} por confirmar</span>
        </div>
        <i className="ti ti-bell-ringing" aria-hidden="true" />
      </header>

      {pendingResults.map(pendingResult => (
        <div key={pendingResult.id} className="pending-result-row">
          <div>
            <span>{tableText(pendingResult)}</span>
            <strong>{resultText(pendingResult)}</strong>
          </div>
          <div>
            <button onClick={() => approvePendingResult(tournament.id, pendingResult.id)}>
              <i className="ti ti-check" aria-hidden="true" />
              Confirmar
            </button>
            <button onClick={() => rejectPendingResult(tournament.id, pendingResult.id)}>
              <i className="ti ti-x" aria-hidden="true" />
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}

async function notifyOrganizer(title: string, body: string) {
  if (!('Notification' in window)) return

  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}

function actionBtnStyle(
  color = 'var(--color-text-primary)',
  borderColor = 'var(--color-border-secondary)'
): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    fontWeight: 500,
    border: `0.5px solid ${borderColor}`,
    borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-secondary)',
    color,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all .15s',
  }
}

const exportButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all .15s',
}

const exportHiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  transform: 'translateX(-120vw)',
}
