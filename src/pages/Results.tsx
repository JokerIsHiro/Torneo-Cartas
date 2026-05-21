import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { Standings } from '../components/Standings'
import { RoundExport } from '../components/RoundExport'
import { useExportImage } from '../hooks/useExportImage'
import { useSwissPairings } from '../hooks/useSwissPairings'

// Pantalla final del torneo: permite exportar el standing final y eliminar el torneo.
interface ResultsProps {
  tournamentId: string
}

export function Results({ tournamentId }: ResultsProps) {
  const { name, tcg, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return { name: t?.name ?? '', tcg: t?.tcg ?? 'magic', exists: !!t }
    })
  )
  const deleteTournament = useTournamentsStore(s => s.deleteTournament)
  const { standings } = useSwissPairings(tournamentId)
  const { ref: standingsExportRef, exportImage: exportStandingsImage } = useExportImage()
  const { ref: socialExportRef, exportImage: exportSocialImage } = useExportImage()

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
        <SocialEventExport ref={socialExportRef} tournamentName={name} game={tcg} standings={standings} />
      </div>

      <div style={{
        textAlign: 'center',
        padding: '1.5rem 1rem',
        marginBottom: '1rem',
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-podium-gold)',
        borderRadius: 'var(--border-radius-lg)',
      }}>
        <i className="ti ti-photo-star" aria-hidden="true" style={{ fontSize: '32px', marginBottom: '8px', color: 'var(--color-podium-gold)' }} />
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
        onClick={() => exportSocialImage(`evento-${name || 'torneo'}`)}
        style={primaryActionStyle}
      >
        <i className="ti ti-brand-instagram" aria-hidden="true" /> Imagen para redes
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

function SocialEventExport({
  ref,
  tournamentName,
  game,
  standings,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  tournamentName: string
  game: string
  standings: ReturnType<typeof useSwissPairings>['standings']
}) {
  const topRows = standings.slice(0, 3)
  const playerCount = standings.length

  return (
    <div ref={ref} style={socialCardStyle}>
      <div style={socialBackdropStyle} />
      <div style={socialAccentLineStyle} />
      <header style={socialHeaderStyle}>
        <img src="/subterra-logo.jpg" alt="" style={{ width: 92, height: 92, objectFit: 'contain' }} />
        <div>
          <span style={socialEyebrowStyle}>Comunidad Subterra</span>
          <h1 style={socialTitleStyle}>{tournamentName || 'Torneo finalizado'}</h1>
          <p style={socialSubtitleStyle}>{gameLabel(game)} - Evento de tienda</p>
        </div>
      </header>

      <main style={socialMainStyle}>
        <span style={socialChampionLabelStyle}>Gracias por jugar</span>
        <strong style={socialWinnerStyle}>Nos vemos en el proximo torneo</strong>
        <span style={socialRecordStyle}>
          {playerCount > 0 ? `${playerCount} jugadores - rondas Swiss - ambiente de tienda` : 'Torneo finalizado'}
        </span>
      </main>

      <section style={socialPodiumStyle}>
        <span style={socialSectionLabelStyle}>Top del evento</span>
        {topRows.map(row => (
          <div key={row.player.id} style={socialPodiumItemStyle}>
            <span style={socialPositionStyle}>#{row.position}</span>
            <strong>{row.player.name}</strong>
            <small>{row.player.points} pts</small>
          </div>
        ))}
      </section>

      <footer style={socialFooterStyle}>
        <span>Comparte tu partida, tu mazo y tu momento</span>
        <strong>Subterra TCG</strong>
      </footer>
    </div>
  )
}

function gameLabel(game: string) {
  if (game === 'one-piece') return 'One Piece'
  if (game === 'yugioh') return 'YuGiOh'
  if (game === 'pokemon') return 'Pokemon'
  if (game === 'riftbound') return 'Riftbound'
  if (game === 'lorcana') return 'Lorcana'
  return 'Magic'
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

const socialCardStyle: React.CSSProperties = {
  width: 1080,
  height: 1350,
  position: 'relative',
  overflow: 'hidden',
  padding: 72,
  background: '#05070c',
  color: '#f2f7ff',
  fontFamily: 'var(--font-sans)',
  border: '1px solid #164a96',
}

const socialBackdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at 50% 0%, rgba(88, 215, 255, 0.26), transparent 360px), radial-gradient(circle at 92% 78%, rgba(255, 209, 102, 0.11), transparent 300px), linear-gradient(135deg, rgba(31, 122, 255, 0.18), transparent 42%), #05070c',
}

const socialAccentLineStyle: React.CSSProperties = {
  position: 'absolute',
  left: 72,
  right: 72,
  top: 42,
  height: 6,
  background: 'linear-gradient(90deg, #58d7ff, #ffd166, #1f7aff)',
}

const socialHeaderStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 28,
  paddingBottom: 42,
  borderBottom: '2px solid #164a96',
}

const socialEyebrowStyle: React.CSSProperties = {
  color: '#58d7ff',
  fontSize: 28,
  fontWeight: 700,
}

const socialTitleStyle: React.CSSProperties = {
  margin: '8px 0 6px',
  fontSize: 64,
  lineHeight: 1,
}

const socialSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#92a8d8',
  fontSize: 26,
}

const socialMainStyle: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 16,
  alignContent: 'center',
  minHeight: 520,
}

const socialChampionLabelStyle: React.CSSProperties = {
  width: 'fit-content',
  padding: '8px 18px',
  border: '1px solid #806319',
  borderRadius: 6,
  background: '#241a05',
  color: '#ffd166',
  fontSize: 26,
  fontWeight: 700,
}

const socialWinnerStyle: React.CSSProperties = {
  fontSize: 82,
  lineHeight: 0.98,
  maxWidth: 900,
}

const socialRecordStyle: React.CSSProperties = {
  color: '#7c9ad0',
  fontSize: 30,
}

const socialPodiumStyle: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 14,
}

const socialSectionLabelStyle: React.CSSProperties = {
  color: '#58d7ff',
  fontSize: 24,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const socialPodiumItemStyle: React.CSSProperties = {
  minHeight: 104,
  padding: '22px 26px',
  display: 'grid',
  gridTemplateColumns: '92px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 18,
  border: '1px solid #164a96',
  background: 'rgba(7, 16, 31, 0.9)',
}

const socialPositionStyle: React.CSSProperties = {
  color: '#58d7ff',
  fontSize: 32,
  fontWeight: 800,
}

const socialFooterStyle: React.CSSProperties = {
  position: 'absolute',
  left: 72,
  right: 72,
  bottom: 58,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 24,
  color: '#92a8d8',
  fontSize: 26,
}
