import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { Timer } from '../components/Timer'
import { MatchCard } from '../components/MatchCard'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'
import type { PendingMatchResult, Tournament } from '../types/tournament'

interface RoundProps {
  tournamentId: string
}

export function Round({ tournamentId }: RoundProps) {
  const nextRound = useTournamentsStore(s => s.nextRound)
  const finishTournament = useTournamentsStore(s => s.finishTournament)
  const swapCurrentRoundPlayers = useTournamentsStore(s => s.swapCurrentRoundPlayers)
  const addLatePlayerToCurrentRound = useTournamentsStore(s => s.addLatePlayerToCurrentRound)
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
    getPlayerName,
  } = useSwissPairings(tournamentId)

  const { ref: roundExportRef, exportImage: exportRoundImage } = useExportImage()
  const { ref: standingsExportRef, exportImage: exportStandingsImage } = useExportImage()
  const currentSummary = roundSummaries.find(r => r.number === currentRound)
  const previousPendingCount = useRef(pendingResults.length)
  const [firstSwapSlot, setFirstSwapSlot] = useState('')
  const [secondSwapSlot, setSecondSwapSlot] = useState('')
  const [latePlayerName, setLatePlayerName] = useState('')
  const [pairingToolMessage, setPairingToolMessage] = useState('')
  const editablePairings = currentMatches.length > 0
    && currentMatches.every(match => match.result === null)
    && !currentMatches.some(match => match.p2Id === 'BYE')
  const canAddLatePlayer = currentMatches.length > 0
    && currentRound <= 2
    && currentMatches.every(match => match.result === null || match.result === 'bye')
  const playerSlots = useMemo(() => {
    return currentMatches
      .filter(match => match.p2Id !== 'BYE')
      .flatMap(match => [
        { value: `${match.id}:${match.p1Id}`, label: `Mesa ${match.tableNumber} · ${getPlayerName(match.p1Id)}` },
        { value: `${match.id}:${match.p2Id}`, label: `Mesa ${match.tableNumber} · ${getPlayerName(match.p2Id)}` },
      ])
  }, [currentMatches, getPlayerName])

  useEffect(() => {
    if (pendingResults.length > previousPendingCount.current) {
      void notifyOrganizer('Nuevo resultado pendiente', 'Un jugador ha enviado un resultado para confirmar.')
    }
    previousPendingCount.current = pendingResults.length
  }, [pendingResults.length])

  return (
    <div className="round-workspace">
      <div style={exportHiddenStyle}>
        <RoundExport ref={roundExportRef} tournamentId={tournamentId} type="round" />
        <RoundExport ref={standingsExportRef} tournamentId={tournamentId} type="standings" />
      </div>

      <section className="round-main-column">
        <div className="round-section-header">
          <div>
            <span>
              <i className="ti ti-swords" aria-hidden="true" /> Ronda {currentRound}
            </span>
            {isFinalRound && <em>ronda final</em>}
          </div>

          <div className="round-export-actions">
            <span>
              {currentSummary?.matchesDone ?? 0}/{currentSummary?.matchesTotal ?? 0} resultados
            </span>
            <button onClick={() => exportRoundImage(`ronda-${currentRound}`)} style={exportButtonStyle}>
              <i className="ti ti-download" aria-hidden="true" /> Ronda
            </button>
            <button onClick={() => exportStandingsImage(`clasificacion-ronda-${currentRound}`)} style={exportButtonStyle}>
              <i className="ti ti-trophy" aria-hidden="true" /> Clasificacion
            </button>
          </div>
        </div>

        <div className="round-match-grid">
          {currentMatches.map(match => (
            <MatchCard key={match.id} match={match} tournamentId={tournamentId} />
          ))}
        </div>
      </section>

      <aside className="round-side-column">
        <Timer tournamentId={tournamentId} />

        {tournament && pendingResults.length > 0 && (
          <PendingResultsPanel tournament={tournament} pendingResults={pendingResults} />
        )}

        {editablePairings && (
          <section className="pairing-tools-panel">
            <header>
              <strong>Editar emparejamiento</strong>
              <span>Intercambia jugadores antes del primer resultado</span>
            </header>
            <select value={firstSwapSlot} onChange={event => setFirstSwapSlot(event.target.value)}>
              <option value="">Primer jugador</option>
              {playerSlots.map(slot => (
                <option key={`first-${slot.value}`} value={slot.value}>{slot.label}</option>
              ))}
            </select>
            <select value={secondSwapSlot} onChange={event => setSecondSwapSlot(event.target.value)}>
              <option value="">Segundo jugador</option>
              {playerSlots.map(slot => (
                <option key={`second-${slot.value}`} value={slot.value}>{slot.label}</option>
              ))}
            </select>
            <button
              disabled={!canSwapSlots(firstSwapSlot, secondSwapSlot)}
              onClick={() => {
                const first = parseSwapSlot(firstSwapSlot)
                const second = parseSwapSlot(secondSwapSlot)
                if (!first || !second) return
                swapCurrentRoundPlayers(tournamentId, first.matchId, first.playerId, second.matchId, second.playerId)
                setFirstSwapSlot('')
                setSecondSwapSlot('')
              }}
            >
              <i className="ti ti-arrows-exchange" aria-hidden="true" />
              Intercambiar
            </button>
          </section>
        )}

        {canAddLatePlayer && (
          <section className="pairing-tools-panel">
            <header>
              <strong>Jugador tardio</strong>
              <span>Ronda 1 entra limpio. Ronda 2 entra con 1 derrota. Desde ronda 3 no se permite.</span>
            </header>
            <input
              value={latePlayerName}
              onChange={event => {
                setLatePlayerName(event.target.value)
                setPairingToolMessage('')
              }}
              placeholder="Nombre del jugador"
            />
            <button
              disabled={!latePlayerName.trim()}
              onClick={() => {
                const result = addLatePlayerToCurrentRound(tournamentId, latePlayerName.trim())
                const messages = {
                  'added-to-round': 'Jugador anadido a la ronda actual.',
                  'added-next-round': 'Jugador anadido al torneo. No habia BYE, entrara en la siguiente ronda.',
                  duplicate: 'Ya existe un jugador con ese nombre.',
                  closed: 'Solo se puede anadir en ronda 1 o ronda 2.',
                  'has-results': 'No se puede anadir si ya hay resultados registrados.',
                }
                setPairingToolMessage(messages[result])
                if (result === 'added-to-round' || result === 'added-next-round') {
                  setLatePlayerName('')
                }
              }}
            >
              <i className="ti ti-user-plus" aria-hidden="true" />
              Anadir jugador
            </button>
            {pairingToolMessage && <p>{pairingToolMessage}</p>}
          </section>
        )}

        {allResultsIn && (
          <div style={{ marginTop: '1rem' }}>
            {shouldFinish ? (
              <button onClick={() => finishTournament(tournamentId)} style={actionBtnStyle('var(--color-accent-secondary)', 'var(--color-border-success)')}>
                <i className="ti ti-trophy" aria-hidden="true" /> Finalizar torneo
              </button>
            ) : (
              <button onClick={() => nextRound(tournamentId)} style={actionBtnStyle()}>
                <i className="ti ti-arrow-right" aria-hidden="true" /> Nueva ronda
              </button>
            )}
          </div>
        )}

        {!allResultsIn && unfinishedCount > 0 && (
          <div className="round-missing-results">
            <i className="ti ti-clock" aria-hidden="true" />
            {' '}Faltan {unfinishedCount} {unfinishedCount === 1 ? 'resultado' : 'resultados'} por introducir
          </div>
        )}
      </aside>
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

function parseSwapSlot(value: string) {
  const [matchId, playerId] = value.split(':')
  if (!matchId || !playerId) return null
  return { matchId, playerId }
}

function canSwapSlots(firstValue: string, secondValue: string) {
  const first = parseSwapSlot(firstValue)
  const second = parseSwapSlot(secondValue)
  if (!first || !second) return false
  if (first.matchId === second.matchId) return false
  if (first.playerId === second.playerId) return false
  return true
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
