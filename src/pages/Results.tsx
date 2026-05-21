import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { Standings } from '../components/Standings'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'

// Pantalla final del torneo: permite exportar el standing final y eliminar el torneo.
interface ResultsProps {
  tournamentId: string
}

export function Results({ tournamentId }: ResultsProps) {
  const { name, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return { name: t?.name ?? '', exists: !!t }
    })
  )
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const { ref: standingsExportRef, exportImage: exportStandingsImage } = useExportImage()

  if (!exists) return null

  function openDeckBuilder() {
    const url = new URL('/deckbuilder', window.location.origin)
    url.searchParams.set('torneo', tournamentId)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <div style={exportHiddenStyle}>
        <RoundExport ref={standingsExportRef} tournamentId={tournamentId} type="standings" />
      </div>

      <div style={{
        textAlign: 'center',
        padding: '1.5rem 1rem',
        marginBottom: '1rem',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-podium-gold)',
        borderRadius: 'var(--border-radius-lg)',
      }}>
        <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: '32px', marginBottom: '8px', color: 'var(--color-podium-gold)' }} />
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {name}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Torneo finalizado
        </div>
      </div>

      <button
        onClick={() => exportStandingsImage(`standing-final-${name || 'torneo'}`)}
        style={primaryActionStyle}
      >
        <i className="ti ti-download" aria-hidden="true" /> Exportar standing final
      </button>

      <button
        onClick={openDeckBuilder}
        style={primaryActionStyle}
      >
        <i className="ti ti-cards" aria-hidden="true" /> Abrir constructor de decks
      </button>

      <Standings tournamentId={tournamentId} showPodium={false} />

      <button
        onClick={() => {
          if (confirm('¿Seguro que quieres eliminar este torneo?')) {
            deleteTournament(tournamentId)
          }
        }}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '13px',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--color-background-primary)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          marginTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <i className="ti ti-trash" aria-hidden="true" /> Eliminar torneo
      </button>
    </div>
  )
}

const exportHiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  transform: 'translateX(-120vw)',
}

const primaryActionStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  fontSize: '13px',
  fontWeight: 600,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  marginBottom: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}
