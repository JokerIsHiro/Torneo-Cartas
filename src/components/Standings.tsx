// Clasificacion visual del torneo actual. Cambia aqui columnas, podium o resumen
// de rondas; los calculos de desempate salen de useSwissPairings.
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { MatchResult, Player, TournamentTiebreakerSystem } from '../types/tournament'
import {
  formatTiebreakerValue,
  getTiebreakerMetricLabel,
  getTiebreakerSystemOption,
  getTiebreakerValue,
  tiebreakerSystemOptions,
} from '../utils/tiebreakers'

// Clasificacion del torneo y resumen historico de rondas.
interface StandingsProps {
  tournamentId: string
  showPodium?: boolean
}

export function Standings({ tournamentId, showPodium = true }: StandingsProps) {
  const { status, rounds, tcg, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists: !!t,
        status: t?.status ?? 'setup',
        rounds: t?.rounds ?? [],
        tcg: t?.tcg ?? 'magic',
      }
    })
  )
  const setTiebreakerSystem = useTournamentsStore(s => s.setTiebreakerSystem)
  const {
    standings,
    roundSummaries,
    totalRounds,
    getPlayerName,
    tiebreakerSystem,
    phaseMode,
    topCut,
    tiebreakerLabel,
    primaryTiebreakerMetric,
  } = useSwissPairings(tournamentId)
  const hasDraws = tcg !== 'yugioh'
  const standingsColumns = hasDraws
    ? '28px 1fr 44px 44px 44px 44px 58px'
    : '28px 1fr 44px 44px 44px 58px'

  if (!exists || status === 'setup') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        <i className="ti ti-trophy-off" aria-hidden="true" style={{ fontSize: '24px' }} />
        <div style={{ marginTop: '8px' }}>Inicia el torneo para ver la clasificacion</div>
      </div>
    )
  }

  return (
    <div>
      {showPodium && standings.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          <PodiumCard player={standings[0].player} medal="1" position={1} hasDraws={hasDraws} />
          <PodiumCard player={standings[1].player} medal="2" position={2} hasDraws={hasDraws} />
          <PodiumCard player={standings[2].player} medal="3" position={3} hasDraws={hasDraws} />
        </div>
      )}

      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '.75rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr minmax(220px, 320px)',
          gap: '10px',
          alignItems: 'center',
          padding: '4px 10px',
          marginBottom: '4px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            <i className="ti ti-list-numbers" aria-hidden="true" /> Clasificacion general
            <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
              {getTiebreakerSystemOption(tiebreakerSystem).description}
              {phaseMode === 'swiss-top' && ` · Corte: Top ${topCut}`}
            </div>
          </div>
          <select
            value={tiebreakerSystem}
            onChange={event => setTiebreakerSystem(tournamentId, event.target.value as TournamentTiebreakerSystem)}
            style={selectStyle}
            aria-label="Sistema de desempates"
          >
            {tiebreakerSystemOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: standingsColumns,
          gap: '4px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>
          <span>#</span><span>Jugador</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>V</span>
          {hasDraws && <span style={{ textAlign: 'center' }}>E</span>}
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center' }}>{primaryTiebreakerMetric ? getTiebreakerMetricLabel(primaryTiebreakerMetric) : tiebreakerLabel}</span>
        </div>

        {standings.map(row => (
          <div key={row.player.id} style={{
            display: 'grid',
            gridTemplateColumns: standingsColumns,
            gap: '4px',
            alignItems: 'center',
            padding: '7px 10px',
            borderRadius: 'var(--border-radius-md)',
            background: row.position % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
            border: phaseMode === 'swiss-top' && row.position === topCut
              ? '0.5px solid var(--color-border-success)'
              : '0.5px solid transparent',
            opacity: row.isEliminated && status !== 'finished' ? 0.5 : 1,
          }}>
            <span style={{ fontSize: '12px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {row.position}
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.player.name}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>{row.player.points}</span>
            <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.wins}</span>
            {hasDraws && <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.draws}</span>}
            <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.losses}</span>
            <span style={{ fontSize: '12px', textAlign: 'center', color: 'var(--color-accent-secondary)' }}>
              {formatTiebreakerValue(primaryTiebreakerMetric, getTiebreakerValue(row.tiebreakers, primaryTiebreakerMetric))}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '1rem 1.25rem',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '.75rem' }}>
          <i className="ti ti-history" aria-hidden="true" /> Historial de rondas
        </div>

        {roundSummaries.map(summary => {
          const round = rounds[summary.number - 1]
          return (
            <div key={summary.number} style={{ marginBottom: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Ronda {summary.number}
                  {summary.number === totalRounds && (
                    <span style={{
                      marginLeft: '6px',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'var(--color-draw-bg)',
                      color: 'var(--color-accent-secondary)',
                      border: '0.5px solid var(--color-border-primary)',
                    }}>final</span>
                  )}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {summary.matchesDone}/{summary.matchesTotal} resultados
                  {summary.isComplete && (
                    <i className="ti ti-circle-check" aria-hidden="true" style={{ marginLeft: '6px', color: 'var(--color-accent-secondary)' }} />
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {round.matches.map(match => (
                  <RoundResultRow
                    key={match.id}
                    tableNumber={match.tableNumber}
                    p1Name={getPlayerName(match.p1Id)}
                    p2Name={match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)}
                    result={match.result}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '12px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}

function RoundResultRow({
  tableNumber,
  p1Name,
  p2Name,
  result,
}: {
  tableNumber: number
  p1Name: string
  p2Name: string
  result: MatchResult
}) {
  const resultLabel = (() => {
    if (!result) return { text: 'Sin resultado', color: 'var(--color-text-secondary)' }
    if (result === 'bye') return { text: `${p1Name} BYE`, color: 'var(--color-text-warning)' }
    if (result === 'draw') return { text: 'Empate', color: 'var(--color-accent-primary)' }
    if (result === 'timeout') return { text: 'Tiempo agotado', color: 'var(--color-text-danger)' }
    if (result === 'p1') return { text: `Gana ${p1Name}`, color: 'var(--color-accent-secondary)' }
    if (result === 'p2') return { text: `Gana ${p2Name}`, color: 'var(--color-accent-secondary)' }
    return { text: '-', color: 'var(--color-text-secondary)' }
  })()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '48px 1fr auto',
      alignItems: 'center',
      gap: '8px',
      padding: '5px 8px',
      borderRadius: 'var(--border-radius-md)',
      background: 'var(--color-background-secondary)',
      fontSize: '12px',
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>Mesa {tableNumber}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
        {p1Name}
        <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', margin: '0 4px' }}>vs</span>
        {p2Name}
      </span>
      <span style={{ color: resultLabel.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {resultLabel.text}
      </span>
    </div>
  )
}

function PodiumCard({ player, medal, position, hasDraws }: { player: Player; medal: string; position: number; hasDraws: boolean }) {
  const accents: Record<number, { border: string }> = {
    1: { border: 'var(--color-podium-gold)' },
    2: { border: 'var(--color-podium-silver)' },
    3: { border: 'var(--color-podium-bronze)' },
  }
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${accents[position].border}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '.875rem .75rem',
      textAlign: 'center',
      borderBottom: `${position === 1 ? 5 : position === 2 ? 4 : 3}px solid ${accents[position].border}`,
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', color: accents[position].border }}>{medal}</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {player.name}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        {player.points} pts · {player.wins}V {hasDraws ? `${player.draws}E ` : ''}{player.losses}D
      </div>
    </div>
  )
}
