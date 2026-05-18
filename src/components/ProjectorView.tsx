import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { MatchCard } from './MatchCard'
import { TimersView } from './TimersView'
import type { Tournament } from '../types/tournament'

type ProjectorTab = 'pairings' | 'timers'

export function ProjectorView() {
  const [tab, setTab] = useState<ProjectorTab>('pairings')
  const tournaments = useTournamentsStore(
    useShallow(s => s.tournaments.filter(t => t.status === 'active'))
  )

  if (!tournaments.length) {
    return (
      <div className="empty-state">
        <i className="ti ti-screen-share-off" aria-hidden="true" />
        <div>No hay torneos activos para proyectar</div>
      </div>
    )
  }

  return (
    <div>
      <div className="segmented-tabs projector-tabs">
        <button
          onClick={() => setTab('pairings')}
          className={tab === 'pairings' ? 'active' : ''}
        >
          <i className="ti ti-swords" aria-hidden="true" />
          Emparejamientos
        </button>
        <button
          onClick={() => setTab('timers')}
          className={tab === 'timers' ? 'active' : ''}
        >
          <i className="ti ti-clock" aria-hidden="true" />
          Temporizadores
        </button>
      </div>

      {tab === 'pairings' && (
        <div className="projector-pairings">
          {tournaments.map(tournament => (
            <ProjectedTournament key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}

      {tab === 'timers' && <TimersView />}
    </div>
  )
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
