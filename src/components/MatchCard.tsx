import type { Match, MatchResult } from '../types/tournament'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

interface MatchCardProps {
  match: Match
  tournamentId: string
}

export function MatchCard({ match, tournamentId }: MatchCardProps) {
  const setMatchResult = useTournamentsStore(s => s.setMatchResult)
  const tcg = useTournamentsStore(
    s => s.tournaments.find(t => t.id === tournamentId)?.tcg ?? 'magic'
  )
  const { getPlayerName, getPlayerById } = useSwissPairings(tournamentId)

  const p1 = getPlayerById(match.p1Id)
  const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)
  const p2 = match.p2Id !== 'BYE' ? getPlayerById(match.p2Id) : null

  const isBye     = match.p2Id === 'BYE'
  const isTimeout = match.result === 'timeout'
  const isDone    = match.result !== null
  const allowsDraw = tcg !== 'yugioh'

  function handleResult(result: MatchResult) {
    if (isBye) return
    if (match.result === result) return
    setMatchResult(tournamentId, match.id, result)
  }

  function resultBtnStyle(active: boolean, variant: 'win' | 'draw' | 'timeout'): React.CSSProperties {
    const colors = {
      win:     { bg: 'var(--color-success-bg)', border: 'var(--color-border-success)', color: 'var(--color-accent-secondary)' },
      draw:    { bg: 'var(--color-draw-bg)', border: 'var(--color-border-primary)', color: 'var(--color-accent-primary)' },
      timeout: { bg: 'var(--color-danger-bg)', border: 'var(--color-border-danger)', color: 'var(--color-text-danger)' },
    }
    const c = colors[variant]
    return {
      flex: 1,
      padding: '6px 8px',
      fontSize: '12px',
      border: active ? `0.5px solid ${c.border}` : '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-md)',
      background: active ? c.bg : 'var(--color-background-secondary)',
      color: active ? c.color : 'var(--color-text-secondary)',
      cursor: isBye ? 'default' : 'pointer',
      transition: 'all .15s',
      textAlign: 'center' as const,
      fontWeight: active ? 500 : 400,
    }
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '.875rem 1rem',
      marginBottom: '.625rem',
      opacity: isDone && !isTimeout ? 0.75 : 1,
      transition: 'opacity .2s, border-color .2s',
    }}>

      {/* Cabecera */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '.625rem',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          Mesa {match.tableNumber}
        </span>
        <ResultBadge result={match.result} />
      </div>

      {/* Jugadores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '.75rem',
      }}>
        <PlayerCell
          name={getPlayerName(match.p1Id)}
          points={p1?.points ?? 0}
          losses={p1?.losses ?? 0}
          align="left"
          isWinner={match.result === 'p1'}
          isLoser={match.result === 'p2' || match.result === 'timeout'}
        />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          vs
        </span>
        <PlayerCell
          name={p2Name}
          points={p2?.points ?? 0}
          losses={p2?.losses ?? 0}
          align="right"
          isWinner={match.result === 'p2'}
          isLoser={match.result === 'p1' || match.result === 'timeout'}
          isBye={isBye}
        />
      </div>

      {/* Botones de resultado */}
      {!isBye && (
        <div style={{
          display: 'flex',
          gap: '6px',
          paddingTop: '.625rem',
          borderTop: '0.5px solid var(--color-border-tertiary)',
        }}>
          <button
            style={{...resultBtnStyle(match.result === 'p1', 'win'), borderRadius: 'var(--border-radius-md)'}}
            onClick={() => handleResult('p1')}
          >
            <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
            {' '}{getPlayerName(match.p1Id)}
          </button>

          {allowsDraw && (
            <button
              style={{...resultBtnStyle(match.result === 'draw', 'draw'), borderRadius: 'var(--border-radius-md)'}}
              onClick={() => handleResult('draw')}
            >
              <i className="ti ti-equal" aria-hidden="true" style={{ fontSize: '12px' }} />
              {' '}Empate
            </button>
          )}

          <button
            style={{...resultBtnStyle(match.result === 'p2', 'win'), borderRadius: 'var(--border-radius-md)'}}
            onClick={() => handleResult('p2')}
          >
            <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
            {' '}{getPlayerName(match.p2Id as string)}
          </button>

          <button
            style={resultBtnStyle(match.result === 'timeout', 'timeout')}
            onClick={() => handleResult('timeout')}
            title="Ambos jugadores pierden por tiempo"
          >
            <i className="ti ti-clock-off" aria-hidden="true" style={{ fontSize: '12px' }} />
            {' '}Tiempo
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

interface PlayerCellProps {
  name: string
  points: number
  losses: number
  align: 'left' | 'right'
  isWinner: boolean
  isLoser: boolean
  isBye?: boolean
}

function PlayerCell({ name, points, losses, align, isWinner, isLoser, isBye }: PlayerCellProps) {
  const color = (() => {
    if (isWinner) return 'var(--color-accent-secondary)'
    if (isLoser)  return 'var(--color-text-danger)'
    return 'var(--color-text-primary)'
  })()

  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color, transition: 'color .2s' }}>
        {isWinner && (
          <i className="ti ti-crown" aria-hidden="true" style={{ fontSize: '12px', marginRight: '4px' }} />
        )}
        {name}
      </div>
      {!isBye && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          {points} pts · {losses} {losses === 1 ? 'derrota' : 'derrotas'}
        </div>
      )}
    </div>
  )
}

function ResultBadge({ result }: { result: MatchResult }) {
  if (!result) return null

  const config = {
    p1:      { label: 'Resultado registrado', bg: 'var(--color-success-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-success)' },
    p2:      { label: 'Resultado registrado', bg: 'var(--color-success-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-success)' },
    draw:    { label: 'Empate',               bg: 'var(--color-draw-bg)', color: 'var(--color-accent-primary)', border: 'var(--color-border-primary)' },
    timeout: { label: 'Tiempo agotado',       bg: 'var(--color-danger-bg)', color: 'var(--color-text-danger)', border: 'var(--color-border-danger)' },
    bye:     { label: 'BYE · +3 pts',         bg: 'var(--color-warning-bg)', color: 'var(--color-text-warning)', border: 'var(--color-border-warning)' },
  }

  const c = config[result]
  return (
    <span style={{
      fontSize: '11px',
      padding: '2px 8px',
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
