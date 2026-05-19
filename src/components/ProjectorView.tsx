import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { MatchCard } from './MatchCard'
import type { Tournament } from '../types/tournament'

// Pantalla publica de emparejamientos. No permite modificar resultados.
export function ProjectorView() {
  const targetTournamentId = getTargetTournamentId()
  const tournaments = useTournamentsStore(
    useShallow(s => s.tournaments.filter(t =>
      t.status === 'active' && (!targetTournamentId || t.id === targetTournamentId)
    ))
  )

  if (!tournaments.length) {
    return (
      <div className="empty-state">
        <i className="ti ti-swords" aria-hidden="true" />
        <div>No hay torneos activos</div>
      </div>
    )
  }

  const density = tournaments.length >= 3 ? 'many' : tournaments.length === 2 ? 'two' : 'single'

  return (
    <div className={`projector-pairings ${density}`}>
      {tournaments.map(tournament => (
        <ProjectedTournament key={tournament.id} tournament={tournament} />
      ))}
    </div>
  )
}

function getTargetTournamentId() {
  const queryStart = window.location.hash.indexOf('?')
  if (queryStart === -1) return ''
  const params = new URLSearchParams(window.location.hash.slice(queryStart + 1))
  return params.get('torneo') ?? ''
}

function ProjectedTournament({ tournament }: { tournament: Tournament }) {
  const { currentMatches, roundSummaries } = useSwissPairings(tournament.id)
  const currentSummary = roundSummaries.find(r => r.number === tournament.currentRound)

  return (
    <section className="projector-section">
      <header className="projector-section-header">
        <div>
          <h2>{tournament.name}</h2>
          <p>Ronda {tournament.currentRound} &middot; Swiss</p>
        </div>
        <span>
          {currentSummary?.matchesDone ?? 0}/{currentSummary?.matchesTotal ?? 0}
        </span>
      </header>

      <div className="projector-match-list">
        {currentMatches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            tournamentId={tournament.id}
            readOnly
          />
        ))}
      </div>
    </section>
  )
}
