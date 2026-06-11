// Tarjeta de una mesa/rivalidad. Ajusta aqui botones de resultado, lectura publica
// y presentacion de jugadores dentro de cada emparejamiento.
import type { Match, MatchResult } from '../types/tournament'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'

// Tarjeta de partida. En admin permite marcar resultados; en proyeccion es solo lectura.
interface MatchCardProps {
  match: Match
  tournamentId: string
  readOnly?: boolean
  roundNumber?: number
}

export function MatchCard({ match, tournamentId, readOnly = false, roundNumber }: MatchCardProps) {
  const setMatchResult = useTournamentsStore(s => s.setMatchResult)
  const setRoundMatchResult = useTournamentsStore(s => s.setRoundMatchResult)
  const tcg = useTournamentsStore(
    s => s.tournaments.find(t => t.id === tournamentId)?.tcg ?? 'magic'
  )
  const magicFormat = useTournamentsStore(
    s => s.tournaments.find(t => t.id === tournamentId)?.magicFormat
  )
  const currentRound = useTournamentsStore(
    s => s.tournaments.find(t => t.id === tournamentId)?.currentRound ?? 0
  )
  const { getPlayerName, getPlayerById } = useSwissPairings(tournamentId)

  const playerIds = getMatchPlayerIds(match)
  const p1 = getPlayerById(match.p1Id)
  const p2Name = match.p2Id === 'BYE' ? 'BYE' : getPlayerName(match.p2Id)
  const p2 = match.p2Id !== 'BYE' ? getPlayerById(match.p2Id) : null

  const isBye     = match.p2Id === 'BYE'
  const isTimeout = match.result === 'timeout'
  const isDone    = match.result !== null
  const isCommanderPod = tcg === 'magic' && magicFormat === 'commander' && playerIds.length > 2
  const allowsDraw = tcg !== 'yugioh'

  function handleResult(result: MatchResult) {
    if (isBye) return
    if (match.result === result) return
    if (roundNumber && roundNumber !== currentRound) {
      setRoundMatchResult(tournamentId, roundNumber, match.id, result)
      return
    }
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
      padding: '6px 9px',
      minHeight: '34px',
      fontSize: '11px',
      border: active ? `0.5px solid ${c.border}` : '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-md)',
      background: active ? c.bg : 'var(--color-background-secondary)',
      color: active ? c.color : 'var(--color-text-secondary)',
      cursor: isBye ? 'default' : 'pointer',
      transition: 'all .15s',
      textAlign: 'center' as const,
      fontWeight: active ? 500 : 400,
      minWidth: 0,
    }
  }

  return (
    <div className={`${readOnly ? 'match-card projector-match-card' : 'match-card'} ${isCommanderPod ? 'match-card-commander-pod' : ''} ${!readOnly && isDone && !isTimeout ? 'done' : ''} ${isBye || readOnly ? 'no-actions' : ''}`}>
      <div className="match-main">
        {/* Cabecera */}
        <div className="match-card-header">
          <div className="match-card-heading">
            <div className="match-table-badge" aria-label={`Mesa ${match.tableNumber}`}>
              <span>Mesa</span>
              <strong>{match.tableNumber}</strong>
            </div>
            {isCommanderPod && <span className="commander-pod-label">Commander pod</span>}
          </div>
          {allowsDraw && !isBye && !readOnly && (
            <button
              className="result-button result-button-draw match-draw-header"
              style={{
                ...resultBtnStyle(match.result === 'draw', 'draw'),
                flex: '0 1 auto',
                minHeight: '30px',
                padding: '5px 10px',
                borderRadius: 'var(--border-radius-md)',
              }}
              onClick={() => handleResult('draw')}
            >
              <i className="ti ti-equal" aria-hidden="true" style={{ fontSize: '12px' }} />
              <span>Empate</span>
            </button>
          )}
          {!readOnly && <ResultBadge result={match.result} />}
        </div>

        {/* Jugadores */}
        {isCommanderPod ? (
          <div className="match-players match-players-pod">
            {playerIds.map((playerId, index) => {
              const resultKey = resultForPlayerIndex(index)
              const player = getPlayerById(playerId)
              return (
                <PlayerCell
                  key={playerId}
                  name={getPlayerName(playerId)}
                  points={player?.points ?? 0}
                  losses={player?.losses ?? 0}
                  align="left"
                  isWinner={!readOnly && match.result === resultKey}
                  isLoser={!readOnly && Boolean(match.result && match.result !== 'draw' && match.result !== resultKey)}
                />
              )
            })}
          </div>
        ) : (
          <div className="match-players">
            <PlayerCell
              name={getPlayerName(match.p1Id)}
              points={p1?.points ?? 0}
              losses={p1?.losses ?? 0}
              align="left"
              isWinner={!readOnly && match.result === 'p1'}
              isLoser={!readOnly && (match.result === 'p2' || match.result === 'timeout')}
            />
            <span className="match-versus">
              vs
            </span>
            <PlayerCell
              name={p2Name}
              points={p2?.points ?? 0}
              losses={p2?.losses ?? 0}
              align="right"
              isWinner={!readOnly && match.result === 'p2'}
              isLoser={!readOnly && (match.result === 'p1' || match.result === 'timeout')}
              isBye={isBye}
            />
          </div>
        )}
      </div>

      {/* Botones de resultado */}
      {!isBye && !readOnly && (
        <div className="match-actions">
          {isCommanderPod ? (
            playerIds.map((playerId, index) => {
              const resultKey = resultForPlayerIndex(index)
              return (
                <button
                  key={playerId}
                  className="result-button result-button-win"
                  style={{...resultBtnStyle(match.result === resultKey, 'win'), borderRadius: 'var(--border-radius-md)'}}
                  onClick={() => handleResult(resultKey)}
                >
                  <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
                  <span>{isCommanderPod ? getPlayerName(playerId) : `Gana ${getPlayerName(playerId)}`}</span>
                </button>
              )
            })
          ) : (
            <button
              className="result-button result-button-win"
              style={{...resultBtnStyle(match.result === 'p1', 'win'), borderRadius: 'var(--border-radius-md)'}}
              onClick={() => handleResult('p1')}
            >
              <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
              <span>Gana {getPlayerName(match.p1Id)}</span>
            </button>
          )}

          {!isCommanderPod && (
            <button
              className="result-button result-button-win"
              style={{...resultBtnStyle(match.result === 'p2', 'win'), borderRadius: 'var(--border-radius-md)'}}
              onClick={() => handleResult('p2')}
            >
              <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '12px' }} />
              <span>Gana {getPlayerName(match.p2Id as string)}</span>
            </button>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function getMatchPlayerIds(match: Match): string[] {
  if (match.playerIds?.length) return match.playerIds
  return match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
}

function resultForPlayerIndex(index: number): MatchResult {
  return `p${index + 1}` as MatchResult
}

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
    <div className="player-cell" style={{ textAlign: align }}>
      <div className="player-name" style={{ color }}>
        {isWinner && (
          <i className="ti ti-crown" aria-hidden="true" style={{ fontSize: '12px', marginRight: '4px' }} />
        )}
        {name}
      </div>
      {!isBye && (
        <div className="player-meta">
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
    p3:      { label: 'Resultado registrado', bg: 'var(--color-success-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-success)' },
    p4:      { label: 'Resultado registrado', bg: 'var(--color-success-bg)', color: 'var(--color-accent-secondary)', border: 'var(--color-border-success)' },
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
