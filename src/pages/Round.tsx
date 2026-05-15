import { useTournamentStore } from '../store/tournamentStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { Timer } from '../components/Timer'
import { MatchCard } from '../components/MatchCard'

export function Round() {
  const { nextRound, finishTournament, currentRound } = useTournamentStore()
  const {
    currentMatches,
    allResultsIn,
    unfinishedCount,
    isFinalRound,
    shouldFinish,
    roundSummaries,
  } = useSwissPairings()

  const currentSummary = roundSummaries.find(r => r.number === currentRound)

  return (
    <div>
      <Timer />

      {/* Progreso de resultados */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          <i className="ti ti-swords" aria-hidden="true" /> Ronda {currentRound}
          {isFinalRound && (
            <span style={{
              marginLeft: '8px',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 'var(--border-radius-md)',
              background: '#EEEDFE',
              color: '#3C3489',
              border: '0.5px solid #AFA9EC',
            }}>
              ronda final
            </span>
          )}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {currentSummary?.matchesDone ?? 0}/{currentSummary?.matchesTotal ?? 0} resultados
        </span>
      </div>

      {/* Partidas */}
      {currentMatches.map(match => (
        <MatchCard key={match.id} match={match} />
      ))}

      {/* Avanzar ronda / finalizar */}
      {allResultsIn && (
        <div style={{ marginTop: '1rem' }}>
          {shouldFinish ? (
            <button onClick={finishTournament} style={actionBtnStyle('#3B6D11', '#C0DD97')}>
              <i className="ti ti-trophy" aria-hidden="true" />
              Finalizar torneo
            </button>
          ) : (
            <button onClick={nextRound} style={actionBtnStyle()}>
              <i className="ti ti-arrow-right" aria-hidden="true" />
              Nueva ronda →
            </button>
          )}
        </div>
      )}

      {/* Aviso si faltan resultados */}
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

function actionBtnStyle(color = 'var(--color-text-primary)', borderColor = 'var(--color-border-secondary)'): React.CSSProperties {
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