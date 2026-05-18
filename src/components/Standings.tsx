import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Player } from '../types/tournament'

interface StandingsProps {
  tournamentId: string
}

export function Standings({ tournamentId }: StandingsProps) {
  const { status, rounds, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists:       !!t,
        status:       t?.status       ?? 'setup',
        rounds:       t?.rounds       ?? [],
      }
    })
  )
  const { standings, roundSummaries, totalRounds, getPlayerName } = useSwissPairings(tournamentId)

  if (!exists || status === 'setup') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        <i className="ti ti-trophy-off" aria-hidden="true" style={{ fontSize: '24px' }} />
        <div style={{ marginTop: '8px' }}>Inicia el torneo para ver la clasificación</div>
      </div>
    )
  }

  return (
    <div>
      {standings.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          <PodiumCard player={standings[1].player} medal="🥈" position={2} />
          <PodiumCard player={standings[0].player} medal="🥇" position={1} />
          <PodiumCard player={standings[2].player} medal="🥉" position={3} />
        </div>
      )}

      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '.75rem',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', padding: '4px 10px', marginBottom: '4px' }}>
          <i className="ti ti-list-numbers" aria-hidden="true" /> Clasificación general
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 56px',
          gap: '4px', padding: '4px 10px',
          fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)',
        }}>
          <span>#</span><span>Jugador</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>V</span>
          <span style={{ textAlign: 'center' }}>E</span>
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center' }}>Tiempo</span>
        </div>

        {standings.map(row => (
          <div key={row.player.id} style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 56px',
            gap: '4px', alignItems: 'center',
            padding: '7px 10px',
            borderRadius: 'var(--border-radius-md)',
            background: row.position % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
            opacity: row.isEliminated && status !== 'finished' ? 0.5 : 1,
          }}>
            <span style={{ fontSize: '13px', textAlign: 'center' }}>
              {({ 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>)[row.position]
                ?? <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{row.position}</span>}
            </span>
            <span style={{
              fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.player.name}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>{row.player.points}</span>
            <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.wins}</span>
            <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.draws}</span>
            <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{row.player.losses}</span>
            <span style={{
              fontSize: '12px', textAlign: 'center',
              color: row.player.timeoutLosses > 0 ? 'var(--color-text-warning)' : 'var(--color-text-secondary)',
              fontWeight: row.player.timeoutLosses > 0 ? 500 : 400,
            }}>
              {row.player.timeoutLosses > 0 ? `${row.player.timeoutLosses} ⏱` : '—'}
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
                      marginLeft: '6px', fontSize: '10px', padding: '1px 6px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'var(--color-draw-bg)', color: 'var(--color-accent-secondary)', border: '0.5px solid var(--color-border-primary)',
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
                {round.matches.map(match => {
                  const p1Name = getPlayerName(match.p1Id)
                  const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)
                  const resultLabel = (() => {
                    if (!match.result)              return { text: 'Sin resultado',   color: 'var(--color-text-secondary)' }
                    if (match.result === 'bye')     return { text: `${p1Name} · BYE`, color: 'var(--color-text-warning)' }
                    if (match.result === 'draw')    return { text: 'Empate',           color: 'var(--color-accent-primary)' }
                    if (match.result === 'timeout') return { text: 'Tiempo agotado',   color: 'var(--color-text-danger)' }
                    if (match.result === 'p1')      return { text: `Gana ${p1Name}`,   color: 'var(--color-accent-secondary)' }
                    if (match.result === 'p2')      return { text: `Gana ${p2Name}`,   color: 'var(--color-accent-secondary)' }
                    return { text: '—', color: 'var(--color-text-secondary)' }
                  })()

                  return (
                    <div key={match.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr auto',
                      alignItems: 'center',
                      gap: '8px', padding: '5px 8px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'var(--color-background-secondary)',
                      fontSize: '12px',
                    }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Mesa {match.tableNumber}</span>
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
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PodiumCard({ player, medal, position }: { player: Player; medal: string; position: number }) {
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
      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{medal}</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {player.name}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        {player.points} pts · {player.wins}V {player.draws}E {player.losses}D
      </div>
    </div>
  )
}
