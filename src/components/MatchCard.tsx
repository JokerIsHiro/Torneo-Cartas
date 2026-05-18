import type { Match, MatchResult } from '../types/tournament'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

interface MatchCardProps {
  match: Match
  tournamentId: string
}

export function MatchCard({ match, tournamentId }: MatchCardProps) {
  const setMatchResult = useTournamentsStore(s => s.setMatchResult)
  const { getPlayerName, getPlayerById } = useSwissPairings(tournamentId)

  const p1 = getPlayerById(match.p1Id)
  const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)
  const p2 = match.p2Id !== 'BYE' ? getPlayerById(match.p2Id) : null

  const isBye     = match.p2Id === 'BYE'
  const isTimeout = match.result === 'timeout'
  const isDone    = match.result !== null

  function handleResult(result: MatchResult) {
    if (isBye) return
    if (match.result === result) return
    setMatchResult(tournamentId, match.id, result)
  }

  function resultBtnStyle(active: boolean, variant: 'win' | 'draw' | 'timeout'): React.CSSProperties {
    const colors = {
      win:     { bg: '#EAF3DE', border: '#3B6D11', color: '#27500A' },
      draw:    { bg: '#E6F1FB', border: '#185FA5', color: '#0C447C' },
      timeout: { bg: '#FCEBEB', border: '#A32D2D', color: '#791F1F' },
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
      border: `0.5px solid ${isTimeout ? '#F7C1C1' : 'var(--color-border-tertiary)'}`,
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
            style={resultBtnStyle(match.result === 'p1', 'win')}
            onClick={() => handleResult('p1')}
          >
            <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
            {' '}{getPlayerName(match.p1Id)}
          </button>

          <button
            style={resultBtnStyle(match.result === 'draw', 'draw')}
            onClick={() => handleResult('draw')}
          >
            <i className="ti ti-equal" aria-hidden="true" style={{ fontSize: '12px' }} />
            {' '}Empate
          </button>

          <button
            style={resultBtnStyle(match.result === 'p2', 'win')}
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
    if (isWinner) return '#27500A'
    if (isLoser)  return '#791F1F'
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
    p1:      { label: 'Resultado registrado', bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
    p2:      { label: 'Resultado registrado', bg: '#EAF3DE', color: '#27500A', border: '#C0DD97' },
    draw:    { label: 'Empate',               bg: '#E6F1FB', color: '#0C447C', border: '#B5D4F4' },
    timeout: { label: 'Tiempo agotado',       bg: '#FCEBEB', color: '#791F1F', border: '#F7C1C1' },
    bye:     { label: 'BYE · +3 pts',         bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
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