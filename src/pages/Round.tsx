// Mesa de trabajo de la ronda activa. Aqui se introducen resultados, se organizan
// emparejamientos y se exportan imagenes de ronda/clasificacion.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { Timer } from '../components/Timer'
import { MatchCard } from '../components/MatchCard'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'
import { ExportPreviewModal } from '../components/ExportPreviewModal'
import type { ExportedImage } from '../hooks/useExportImage'
import type { Match, MatchResult, PendingMatchResult, Tournament } from '../types/tournament'

interface RoundProps {
  tournamentId: string
  mode?: 'results' | 'organize'
}

export function Round({ tournamentId, mode = 'results' }: RoundProps) {
  const nextRound = useTournamentsStore(s => s.nextRound)
  const finishTournament = useTournamentsStore(s => s.finishTournament)
  const approvePendingResult = useTournamentsStore(s => s.approvePendingResult)
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
    phaseMode,
    topCut,
    roundSummaries,
    getPlayerName,
  } = useSwissPairings(tournamentId)

  const { ref: roundExportRef, previewImage: previewRoundImage, downloadImage: downloadRoundImage } = useExportImage()
  const { ref: standingsExportRef, previewImage: previewStandingsImage, downloadImage: downloadStandingsImage } = useExportImage()
  const currentSummary = roundSummaries.find(r => r.number === currentRound)
  const previousPendingCount = useRef(pendingResults.length)
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [firstSwapSlot, setFirstSwapSlot] = useState('')
  const [secondSwapSlot, setSecondSwapSlot] = useState('')
  const [latePlayerName, setLatePlayerName] = useState('')
  const [pairingToolMessage, setPairingToolMessage] = useState('')
  const [exportPreview, setExportPreview] = useState<{ title: string; image: ExportedImage; download: (image: ExportedImage) => void } | null>(null)
  const visibleRound = selectedRound && selectedRound <= currentRound ? selectedRound : currentRound
  const visibleRoundData = tournament?.rounds.find(round => round.number === visibleRound)
  const visibleMatches = visibleRoundData?.matches ?? []
  const visibleSummary = roundSummaries.find(r => r.number === visibleRound)
  const isViewingCurrentRound = visibleRound === currentRound
  const editablePairings = currentMatches.length > 0
    && currentMatches.every(match => match.result === null)
    && !currentMatches.some(match => match.p2Id === 'BYE')
  const canAddLatePlayer = currentMatches.length > 0
    && currentRound <= 2
    && currentMatches.every(match => match.result === null || match.result === 'bye')
  const playerSlots = useMemo(() => {
    // Lista plana de jugadores movibles: cada item sabe en que mesa y slot esta.
    return currentMatches
      .filter(match => match.p2Id !== 'BYE')
      .flatMap(match => getMatchPlayerIds(match).map(playerId => ({
        value: `${match.id}:${playerId}`,
        label: `Mesa ${match.tableNumber} Â· ${getPlayerName(playerId)}`,
      })))
  }, [currentMatches, getPlayerName])

  function handleSwapPlayers(firstValue: string, secondValue: string) {
    // El tablero visual sigue usando la misma operacion segura: intercambiar dos slots.
    const first = parseSwapSlot(firstValue)
    const second = parseSwapSlot(secondValue)
    if (!first || !second || !canSwapSlots(firstValue, secondValue)) return
    swapCurrentRoundPlayers(tournamentId, first.matchId, first.playerId, second.matchId, second.playerId)
    setFirstSwapSlot('')
    setSecondSwapSlot('')
  }

  async function openRoundPreview() {
    const image = await previewRoundImage(`ronda-${visibleRound}`)
    if (image) setExportPreview({ title: `Emparejamientos ronda ${visibleRound}`, image, download: downloadRoundImage })
  }

  async function openStandingsPreview() {
    const image = await previewStandingsImage(`clasificacion-ronda-${visibleRound}`)
    if (image) setExportPreview({ title: `Clasificacion ronda ${visibleRound}`, image, download: downloadStandingsImage })
  }

  useEffect(() => {
    if (pendingResults.length > previousPendingCount.current) {
      void notifyOrganizer('Nuevo resultado pendiente', 'Un jugador ha enviado un resultado para confirmar.')
    }
    previousPendingCount.current = pendingResults.length
  }, [pendingResults.length])

  useEffect(() => {
    const consensusResult = findConsensusPendingResult(pendingResults)
    if (!consensusResult) return
    approvePendingResult(tournamentId, consensusResult.id)
  }, [approvePendingResult, pendingResults, tournamentId])

  if (mode === 'organize') {
    return (
      <PairingOrganizer
        currentRound={currentRound}
        currentMatches={currentMatches}
        editablePairings={editablePairings}
        firstSwapSlot={firstSwapSlot}
        secondSwapSlot={secondSwapSlot}
        playerSlots={playerSlots}
        getPlayerName={getPlayerName}
        onSelectSlot={setFirstSwapSlot}
        onSelectTargetSlot={setSecondSwapSlot}
        onClearSelection={() => {
          setFirstSwapSlot('')
          setSecondSwapSlot('')
        }}
        onSwapPlayers={handleSwapPlayers}
      />
    )
  }

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
            {!isViewingCurrentRound && <em>editando ronda {visibleRound}</em>}
          </div>

          <div className="round-export-actions">
            <span>
              {visibleSummary?.matchesDone ?? currentSummary?.matchesDone ?? 0}/{visibleSummary?.matchesTotal ?? currentSummary?.matchesTotal ?? 0} resultados
            </span>
            <button
              onClick={() => void openRoundPreview()}
              style={exportButtonStyle}
              title="Previsualiza una imagen con las mesas de esta ronda"
            >
              <i className="ti ti-photo-scan" aria-hidden="true" /> Ver emparejamientos
            </button>
            <button
              onClick={() => void openStandingsPreview()}
              style={exportButtonStyle}
              title="Previsualiza la clasificacion actual en imagen"
            >
              <i className="ti ti-trophy" aria-hidden="true" /> Ver clasificacion
            </button>
          </div>
        </div>

        {roundSummaries.length > 1 && (
          <div className="round-history-tabs">
            {roundSummaries.map(summary => (
              <button
                key={summary.number}
                onClick={() => setSelectedRound(summary.number === currentRound ? null : summary.number)}
                className={visibleRound === summary.number ? 'active' : ''}
              >
                <i className={summary.isComplete ? 'ti ti-circle-check' : 'ti ti-circle'} aria-hidden="true" />
                Ronda {summary.number}
              </button>
            ))}
          </div>
        )}

        {!isViewingCurrentRound && (
          <div className="round-edit-warning">
            <i className="ti ti-alert-triangle" aria-hidden="true" />
            Corrige solo lo necesario: la clasificacion se recalcula, pero las rondas posteriores ya creadas no se regeneran automaticamente.
          </div>
        )}

        {canAddLatePlayer && (
          <section className="pairing-tools-panel late-player-panel">
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
              Anadir jugador tardio
            </button>
            {pairingToolMessage && <p>{pairingToolMessage}</p>}
          </section>
        )}

        <div className="round-match-grid">
          {visibleMatches.map(match => (
            <MatchCard key={match.id} match={match} tournamentId={tournamentId} roundNumber={visibleRound} />
          ))}
        </div>
      </section>

      <aside className="round-side-column">
        {isViewingCurrentRound && <Timer tournamentId={tournamentId} />}

        {tournament && pendingResults.length > 0 && (
          <PendingResultsPanel tournament={tournament} pendingResults={pendingResults} />
        )}

        {allResultsIn && (
          <div style={{ marginTop: '1rem' }}>
            {shouldFinish ? (
              <button onClick={() => finishTournament(tournamentId)} style={actionBtnStyle('var(--color-accent-secondary)', 'var(--color-border-success)')}>
                <i className="ti ti-trophy" aria-hidden="true" /> {phaseMode === 'swiss-top' ? `Cerrar suizo y publicar Top ${topCut}` : 'Finalizar torneo y cerrar inscripcion'}
              </button>
            ) : (
              <button onClick={() => nextRound(tournamentId)} style={actionBtnStyle()} title="Genera la siguiente ronda cuando todos los resultados esten listos">
                <i className="ti ti-arrow-right" aria-hidden="true" /> Pasar a la siguiente ronda
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

      <ExportPreviewModal
        image={exportPreview?.image ?? null}
        title={exportPreview?.title ?? 'Vista previa'}
        onClose={() => setExportPreview(null)}
        onDownload={image => {
          exportPreview?.download(image)
          setExportPreview(null)
        }}
      />
    </div>
  )
}

interface PairingOrganizerProps {
  currentRound: number
  currentMatches: Match[]
  editablePairings: boolean
  firstSwapSlot: string
  secondSwapSlot: string
  playerSlots: Array<{ value: string; label: string }>
  getPlayerName: (id: string) => string
  onSelectSlot: (slot: string) => void
  onSelectTargetSlot: (slot: string) => void
  onClearSelection: () => void
  onSwapPlayers: (firstSlot: string, secondSlot: string) => void
}

function PairingOrganizer({
  currentRound,
  currentMatches,
  editablePairings,
  firstSwapSlot,
  secondSwapSlot,
  playerSlots,
  getPlayerName,
  onSelectSlot,
  onSelectTargetSlot,
  onClearSelection,
  onSwapPlayers,
}: PairingOrganizerProps) {
  // Vista dedicada para revisar mesas antes de publicar resultados.
  const slotLabels = new Map(playerSlots.map(slot => [slot.value, slot.label]))
  const selectedSlotLabel = firstSwapSlot ? slotLabels.get(firstSwapSlot) : ''
  const targetSlotLabel = secondSwapSlot ? slotLabels.get(secondSwapSlot) : ''
  const canConfirmSwap = Boolean(firstSwapSlot && secondSwapSlot && canSwapSlots(firstSwapSlot, secondSwapSlot))

  function handleSlotClick(slot: string) {
    if (!editablePairings) return
    if (!firstSwapSlot) {
      onSelectSlot(slot)
      return
    }
    if (slot === firstSwapSlot) {
      onClearSelection()
      return
    }
    if (!canSwapSlots(firstSwapSlot, slot)) return
    onSelectTargetSlot(slot)
  }

  return (
    <section className="pairing-organizer-page">
      <div className="round-section-header">
        <div>
          <span>
            <i className="ti ti-arrows-shuffle" aria-hidden="true" /> Organizar ronda {currentRound}
          </span>
          <em>{editablePairings ? 'editable' : 'bloqueado'}</em>
        </div>
      </div>

      {!editablePairings && (
        <div className="round-edit-warning">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          Solo se pueden reorganizar emparejamientos antes de introducir el primer resultado y si no hay BYE.
        </div>
      )}

      {editablePairings && (
        <div className={firstSwapSlot ? 'pairing-swap-bar active' : 'pairing-swap-bar'}>
          <div className="pairing-swap-step">
            <div>
              <strong>Jugador seleccionado</strong>
              <em>{selectedSlotLabel ?? 'Elige jugador'}</em>
            </div>
          </div>
          <i className="ti ti-arrows-exchange" aria-hidden="true" />
          <div className="pairing-swap-step">
            <div>
              <strong>Intercambiar con</strong>
              <em>{targetSlotLabel ?? 'Elige otro jugador'}</em>
            </div>
          </div>
          <button type="button" disabled={!canConfirmSwap} onClick={() => onSwapPlayers(firstSwapSlot, secondSwapSlot)}>
            <i className="ti ti-check" aria-hidden="true" />
            Intercambiar
          </button>
          <button type="button" disabled={!firstSwapSlot && !secondSwapSlot} onClick={onClearSelection}>
            <i className="ti ti-x" aria-hidden="true" />
            Limpiar
          </button>
        </div>
      )}

      <div className="pairing-table-grid">
        {currentMatches.map(match => (
          <article key={match.id} className="pairing-table-row-card">
            <header className="pairing-table-row-header">
              <div className="pairing-table-number">
                <span>Mesa</span>
                <strong>{match.tableNumber}</strong>
              </div>
              {match.p2Id === 'BYE' && <span>BYE</span>}
            </header>

            <div className={getMatchPlayerIds(match).length > 2 ? 'pairing-table-row-players pairing-table-row-players-pod' : 'pairing-table-row-players'}>
              {getMatchPlayerIds(match).map((playerId, index, ids) => {
                const slot = `${match.id}:${playerId}`
                return (
                  <div key={slot} className="pairing-player-slot-wrap">
                    <PairingPlayerSlot
                      slot={slot}
                      playerName={getPlayerName(playerId)}
                      selected={firstSwapSlot === slot}
                      target={secondSwapSlot === slot}
                      disabled={!editablePairings || match.p2Id === 'BYE'}
                      label={slotLabels.get(slot)}
                      onClick={handleSlotClick}
                    />
                    {ids.length === 2 && index === 0 && <div className="pairing-table-versus">vs</div>}
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

interface PairingPlayerSlotProps {
  slot: string
  playerName: string
  selected: boolean
  target: boolean
  disabled: boolean
  label?: string
  onClick: (slot: string) => void
}

function PairingPlayerSlot({
  slot,
  playerName,
  selected,
  target,
  disabled,
  label,
  onClick,
}: PairingPlayerSlotProps) {
  return (
    <button
      className={`pairing-player-slot${selected ? ' selected' : ''}${target ? ' target' : ''}`}
      disabled={disabled}
      title={label}
      onClick={() => onClick(slot)}
    >
      <span>{playerName}</span>
    </button>
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
    const winnerId = resultForMatchPlayer(match, pendingResult.result)
    if (pendingResult.result === 'draw') return `${playerName(pendingResult.playerId)} reporta empate`
    if (winnerId) return `${playerName(pendingResult.playerId)} reporta que gana ${playerName(winnerId)}`
    return `${playerName(pendingResult.playerId)} reporta tiempo agotado`
  }

  function tableText(pendingResult: PendingMatchResult) {
    const round = tournament.rounds.find(r => r.number === pendingResult.roundNumber)
    const match = round?.matches.find(m => m.id === pendingResult.matchId)
    return match ? `Ronda ${pendingResult.roundNumber} Â· Mesa ${match.tableNumber}` : `Ronda ${pendingResult.roundNumber}`
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
            <button onClick={() => approvePendingResult(tournament.id, pendingResult.id)} title="Aplica el resultado enviado por el jugador">
              <i className="ti ti-check" aria-hidden="true" />
              Confirmar resultado
            </button>
            <button onClick={() => rejectPendingResult(tournament.id, pendingResult.id)} title="Descarta el reporte del jugador">
              <i className="ti ti-x" aria-hidden="true" />
              Rechazar reporte
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

function getMatchPlayerIds(match: Match): string[] {
  if (match.playerIds?.length) return match.playerIds
  return match.p2Id === 'BYE' ? [match.p1Id] : [match.p1Id, match.p2Id]
}

function resultForMatchPlayer(match: Match, result: MatchResult) {
  if (!result || result === 'draw' || result === 'timeout' || result === 'bye') return ''
  const index = Number(result.slice(1)) - 1
  return getMatchPlayerIds(match)[index] ?? ''
}

function findConsensusPendingResult(pendingResults: PendingMatchResult[]) {
  for (const pendingResult of pendingResults) {
    const matchingOpponentReport = pendingResults.find(candidate =>
      candidate.id !== pendingResult.id
      && candidate.matchId === pendingResult.matchId
      && candidate.playerId !== pendingResult.playerId
      && candidate.result === pendingResult.result
    )
    if (matchingOpponentReport) return pendingResult
  }
  return null
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
