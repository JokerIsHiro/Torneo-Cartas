import { useTournamentStore } from '../store/tournamentStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { Player } from '../types/tournament'

export function Standings() {
  const { status, rounds } = useTournamentStore()
  const { standings, roundSummaries, totalRounds, getPlayerName } = useSwissPairings()

  if (status === 'setup') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        <i className="ti ti-trophy-off" aria-hidden="true" style={{ fontSize: '24px' }} />
        <div style={{ marginTop: '8px' }}>Inicia el torneo para ver la clasificación</div>
      </div>
    )
  }

  return (
    <div>
      {/* Podio top 3 */}
      {standings.length >= 3 && (
        <Podium
          first={standings[0].player}
          second={standings[1].player}
          third={standings[2].player}
        />
      )}

      {/* Tabla de clasificación completa */}
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

        {/* Cabecera */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 56px',
          gap: '4px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>
          <span>#</span>
          <span>Jugador</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>V</span>
          <span style={{ textAlign: 'center' }}>E</span>
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center' }}>Tiempo</span>
        </div>

        {standings.map(row => (
          <StandingsRow
            key={row.player.id}
            player={row.player}
            position={row.position}
            isEliminated={row.isEliminated}
            isFinished={status === 'finished'}
          />
        ))}
      </div>

      {/* Historial de rondas */}
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

              {/* Cabecera de ronda */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Ronda {summary.number}
                  {summary.number === totalRounds && (
                    <span style={{
                      marginLeft: '6px',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--border-radius-md)',
                      background: '#EEEDFE',
                      color: '#3C3489',
                      border: '0.5px solid #AFA9EC',
                    }}>
                      final
                    </span>
                  )}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {summary.matchesDone}/{summary.matchesTotal} resultados
                  {summary.isComplete && (
                    <i className="ti ti-circle-check" aria-hidden="true" style={{ marginLeft: '6px', color: '#3B6D11' }} />
                  )}
                </span>
              </div>

              {/* Resultados de cada mesa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {round.matches.map(match => {
                  const p1Name = getPlayerName(match.p1Id)
                  const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)

                  const resultLabel = (() => {
                    if (!match.result)            return { text: 'Sin resultado', color: 'var(--color-text-secondary)' }
                    if (match.result === 'bye')   return { text: `${p1Name} · BYE +3pts`, color: '#854F0B' }
                    if (match.result === 'draw')  return { text: 'Empate', color: '#185FA5' }
                    if (match.result === 'timeout') return { text: 'Tiempo agotado', color: '#A32D2D' }
                    if (match.result === 'p1')    return { text: `Gana ${p1Name}`, color: '#3B6D11' }
                    if (match.result === 'p2')    return { text: `Gana ${p2Name}`, color: '#3B6D11' }
                    return { text: '—', color: 'var(--color-text-secondary)' }
                  })()

                  return (
                    <div key={match.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr auto',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'var(--color-background-secondary)',
                      fontSize: '12px',
                    }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Mesa {match.tableNumber}
                      </span>
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

// ─── Subcomponentes ───────────────────────────────────────────────────────────

interface PodiumProps {
  first: Player
  second: Player
  third: Player
}

function Podium({ first, second, third }: PodiumProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '8px',
      marginBottom: '1rem',
    }}>
      <PodiumCard player={second} medal="🥈" height={80} position={2} />
      <PodiumCard player={first}  medal="🥇" height={100} position={1} />
      <PodiumCard player={third}  medal="🥉" height={64} position={3} />
    </div>
  )
}

interface PodiumCardProps {
  player: Player
  medal: string
  height: number
  position: number
}

function PodiumCard({ player, medal, height, position }: PodiumCardProps) {
  const accentColors: Record<number, { bg: string; border: string }> = {
    1: { bg: '#FAEEDA', border: '#FAC775' },
    2: { bg: '#F1EFE8', border: '#D3D1C7' },
    3: { bg: '#FAECE7', border: '#F5C4B3' },
  }
  const accent = accentColors[position]

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: `0.5px solid ${accent.border}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '.875rem .75rem',
      textAlign: 'center',
      borderBottom: `${height / 20}px solid ${accent.border}`,
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

interface StandingsRowProps {
  player: Player
  position: number
  isEliminated: boolean
  isFinished: boolean
}

function StandingsRow({ player, position, isEliminated, isFinished }: StandingsRowProps) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 44px 44px 44px 44px 56px',
      gap: '4px',
      alignItems: 'center',
      padding: '7px 10px',
      borderRadius: 'var(--border-radius-md)',
      background: position % 2 === 0 ? 'var(--color-background-secondary)' : 'transparent',
      opacity: isEliminated && !isFinished ? 0.5 : 1,
    }}>

      <span style={{ fontSize: '13px', textAlign: 'center' }}>
        {medals[position] ?? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{position}</span>
        )}
      </span>

      <span style={{
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {player.name}
      </span>

      <span style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center', color: 'var(--color-text-primary)' }}>
        {player.points}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.wins}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.draws}
      </span>
      <span style={{ fontSize: '13px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {player.losses}
      </span>
      <span style={{
        fontSize: '12px',
        textAlign: 'center',
        color: player.timeoutLosses > 0 ? '#854F0B' : 'var(--color-text-secondary)',
        fontWeight: player.timeoutLosses > 0 ? 500 : 400,
      }}>
        {player.timeoutLosses > 0
          ? `${player.timeoutLosses} ⏱`
          : '—'
        }
      </span>
    </div>
  )
}