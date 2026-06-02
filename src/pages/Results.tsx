// Pantalla final del torneo. Cambia aqui acciones post-torneo, exportacion final
// y presentacion de resultados cerrados.
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { Standings } from '../components/Standings'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'
import { useSwissPairings } from '../hooks/useSwissPairings'
import type { DeckList } from '../types/tournament'

// Pantalla final del torneo: permite exportar el standing final y eliminar el torneo.
interface ResultsProps {
  tournamentId: string
}

export function Results({ tournamentId }: ResultsProps) {
  const { name, tcg, players, decklists, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        name: t?.name ?? '',
        tcg: t?.tcg ?? 'magic',
        players: t?.players ?? [],
        decklists: t?.decklists ?? [],
        exists: !!t,
      }
    })
  )
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const { ref: standingsExportRef, exportImage: exportStandingsImage } = useExportImage()
  const { standings } = useSwissPairings(tournamentId)
  const winner = standings[0]?.player
  const decklistsReceived = latestDeckCount(decklists)
  const latestDeckByPlayer = useMemo(() => {
    const latestByPlayer = new Map<string, typeof decklists[number]>()
    for (const deck of decklists) {
      const current = latestByPlayer.get(deck.playerId)
      if (!current || deck.updatedAt >= current.updatedAt) latestByPlayer.set(deck.playerId, deck)
    }
    return latestByPlayer
  }, [decklists])

  if (!exists) return null

  function openDeckBuilder(playerId?: string) {
    const url = new URL('/deckbuilder', window.location.origin)
    url.searchParams.set('torneo', tournamentId)
    if (playerId) url.searchParams.set('jugador', playerId)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <div style={exportHiddenStyle}>
        <RoundExport ref={standingsExportRef} tournamentId={tournamentId} type="standings" />
      </div>

      <section className="results-overview">
        <div className="results-title-card">
          <i className="ti ti-trophy" aria-hidden="true" />
          <div>
            <span>Torneo finalizado</span>
            <h3>{name}</h3>
            {winner && <p>Ganador: {winner.name} con {winner.points} puntos</p>}
          </div>
        </div>

        <div className="results-summary-grid">
          <SummaryCell label="Jugadores" value={String(players.length)} />
          <SummaryCell label="Decklists" value={tcg === 'chess' ? '-' : `${decklistsReceived}/${players.length}`} />
          <SummaryCell label="Rondas" value={String(standings.length ? Math.max(...players.map(player => player.wins + player.draws + player.losses + player.byes)) : 0)} />
        </div>

        <div className="results-actions-panel">
          <button onClick={() => exportStandingsImage(`standing-final-${name || 'torneo'}`)}>
            <i className="ti ti-download" aria-hidden="true" /> Descargar clasificacion
          </button>
          {tcg !== 'chess' && (
            <button onClick={() => openDeckBuilder()} title="Monta y exporta las listas de los jugadores">
              <i className="ti ti-cards" aria-hidden="true" /> Constructor de mazos
            </button>
          )}
        </div>
      </section>

      {tcg !== 'chess' && (
        <section className="results-decklist-panel">
          <header>
            <div>
              <strong>Decklists del torneo</strong>
              <span>{latestDeckByPlayer.size}/{players.length} recibidas</span>
            </div>
            <i className="ti ti-cards" aria-hidden="true" />
          </header>

          {standings.map(row => {
            const deck = latestDeckByPlayer.get(row.player.id)
            return (
              <div key={row.player.id} className="results-decklist-row">
                <span>#{row.position}</span>
                <strong>{row.player.name}</strong>
                <em>{deck ? deck.archetype || deck.name : 'Sin lista'}</em>
                <button onClick={() => openDeckBuilder(row.player.id)} title={`Abrir mazo de ${row.player.name} en el constructor`}>
                  <i className="ti ti-pencil" aria-hidden="true" />
                  {deck ? 'Abrir deck' : 'Crear deck'}
                </button>
              </div>
            )
          })}
        </section>
      )}

      <Standings tournamentId={tournamentId} showPodium={false} />

      <button
        onClick={() => {
          if (confirm('¿Seguro que quieres eliminar este torneo?')) {
            deleteTournament(tournamentId)
          }
        }}
        className="results-delete-button"
      >
        <i className="ti ti-trash" aria-hidden="true" /> Eliminar torneo
      </button>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function latestDeckCount(decklists: DeckList[]) {
  return new Set(decklists.map(deck => deck.playerId)).size
}

const exportHiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  transform: 'translateX(-120vw)',
}

