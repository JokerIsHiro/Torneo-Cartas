import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'
import type {
  MagicFormat,
  TournamentPhaseMode,
  TournamentTCG,
  TournamentTeamMode,
  TournamentTiebreakerSystem,
} from '../types/tournament'
import { hasFirebaseConfig } from '../services/firebase'
import { tiebreakerSystemOptions } from '../utils/tiebreakers'

interface SetupProps {
  tournamentId: string
}

const timerOptions = [
  { label: '30 min', value: 30 * 60 },
  { label: '40 min', value: 40 * 60 },
  { label: '50 min', value: 50 * 60 },
  { label: '60 min', value: 60 * 60 },
  { label: '75 min', value: 75 * 60 },
]

const tcgOptions: Array<{ label: string; value: TournamentTCG }> = [
  { label: 'Magic', value: 'magic' },
  { label: 'Riftbound', value: 'riftbound' },
  { label: 'Pokemon', value: 'pokemon' },
  { label: 'YuGiOh', value: 'yugioh' },
  { label: 'Lorcana', value: 'lorcana' },
  { label: 'One Piece', value: 'one-piece' },
  { label: 'Ajedrez', value: 'chess' },
]

const magicFormatOptions: Array<{ label: string; value: MagicFormat; description: string }> = [
  { label: 'Pauper', value: 'pauper', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
  { label: 'Commander', value: 'commander', description: 'Apartado de comandante y 100 cartas singleton en total.' },
  { label: 'Standard', value: 'standard', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
  { label: 'Pioneer', value: 'pioneer', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
  { label: 'Modern', value: 'modern', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
  { label: 'Legacy', value: 'legacy', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
  { label: 'Vintage', value: 'vintage', description: '60 cartas en mazo principal y hasta 15 en sideboard.' },
]

const teamModeOptions: Array<{ label: string; shortLabel: string; value: TournamentTeamMode; description: string }> = [
  { label: 'Normal', shortLabel: '1 jugador', value: 'solo', description: 'Participantes individuales.' },
  { label: '2vs2', shortLabel: 'Equipos de 2', value: '2v2', description: 'Cada participante es un equipo de 2 jugadores.' },
  { label: '3vs3', shortLabel: 'Equipos de 3', value: '3v3', description: 'Cada participante es un equipo de 3 jugadores.' },
]

const phaseModeOptions: Array<{ label: string; shortLabel: string; value: TournamentPhaseMode; description: string }> = [
  { label: 'Suizo', shortLabel: 'Solo rondas', value: 'swiss', description: 'Termina al acabar las rondas suizas estimadas.' },
  { label: 'Suizo + Top', shortLabel: 'Corte final', value: 'swiss-top', description: 'Tras el suizo se juega un Top configurable.' },
]

export function Setup({ tournamentId }: SetupProps) {
  const { name, tcg, magicFormat, teamMode, phaseMode, topCut, timerDuration, tiebreakerSystem, playerCount, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists: !!t,
        name: t?.name ?? '',
        tcg: t?.tcg ?? 'magic',
        magicFormat: t?.magicFormat ?? 'pauper',
        teamMode: t?.teamMode ?? 'solo',
        phaseMode: t?.phaseMode ?? 'swiss',
        topCut: t?.topCut ?? 8,
        timerDuration: t?.timerDuration ?? 50 * 60,
        tiebreakerSystem: t?.tiebreakerSystem ?? 'tcg-resistance',
        playerCount: t?.players.length ?? 0,
      }
    })
  )
  const updateTournamentName = useTournamentsStore(s => s.updateTournamentName)
  const setTournamentTCG = useTournamentsStore(s => s.setTournamentTCG)
  const setTournamentMagicFormat = useTournamentsStore(s => s.setTournamentMagicFormat)
  const setTournamentTeamMode = useTournamentsStore(s => s.setTournamentTeamMode)
  const setTournamentPhaseMode = useTournamentsStore(s => s.setTournamentPhaseMode)
  const setTournamentTopCut = useTournamentsStore(s => s.setTournamentTopCut)
  const setTimerDuration = useTournamentsStore(s => s.setTimerDuration)
  const setTiebreakerSystem = useTournamentsStore(s => s.setTiebreakerSystem)
  const startTournament = useTournamentsStore(s => s.startTournament)
  const { totalRounds } = useSwissPairings(tournamentId)
  const [error, setError] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const firebaseConfigured = hasFirebaseConfig()
  const invitationLink = getInvitationLink()
  const selectedGame = tcgOptions.find(opt => opt.value === tcg)
  const selectedTeamMode = teamModeOptions.find(option => option.value === teamMode)
  const selectedPhaseMode = phaseModeOptions.find(option => option.value === phaseMode)
  const selectedMagicFormat = magicFormatOptions.find(option => option.value === magicFormat)
  const selectedTiebreaker = tiebreakerSystemOptions.find(option => option.value === tiebreakerSystem)
  const participantLabel = teamMode === 'solo' ? 'Jugadores' : 'Equipos'

  if (!exists) return null

  function handleStart() {
    if (playerCount < 2) {
      setError('Necesitas al menos 2 jugadores para iniciar')
      return
    }
    startTournament(tournamentId)
  }

  function getInvitationLink() {
    const publicUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const url = new URL(publicUrl)
    url.pathname = '/inscripcion'
    url.search = `?torneo=${encodeURIComponent(tournamentId)}`
    url.hash = ''
    return url.toString()
  }

  function getInvitationText() {
    const game = tcgOptions.find(opt => opt.value === tcg)?.label ?? 'TCG'
    return `Invitacion a ${name || 'torneo'} (${game}). Inscribete aqui: ${invitationLink}`
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(getInvitationText())
    setInviteStatus('Invitacion copiada')
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  async function shareInvitation() {
    const invitation = {
      title: name || 'Torneo',
      text: getInvitationText(),
      url: invitationLink,
    }

    if (navigator.share) {
      await navigator.share(invitation)
      return
    }

    await copyInvitation()
  }

  function openQrTab() {
    const url = new URL('/qr', window.location.origin)
    url.searchParams.set('torneo', tournamentId)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="setup-workspace">
      <section className="setup-main-column">
        <div className="setup-card setup-ops-card" style={cardStyle}>
          <div className="setup-card-header">
            <div style={cardTitleStyle}>
              <i className="ti ti-adjustments" aria-hidden="true" /> Configuracion rapida
            </div>
            <span>Juego, modalidad y estructura en un solo panel</span>
          </div>

          <div className="setup-name-row">
            <label htmlFor="tournament-name">Nombre</label>
            <input
              id="tournament-name"
              type="text"
              value={name}
              onChange={e => updateTournamentName(tournamentId, e.target.value)}
              placeholder="Mi Torneo"
              style={inputStyle}
            />
          </div>

          <div className="setup-control-grid">
            <section className="setup-control-block">
              <div className="setup-block-title">
                <i className="ti ti-cards" aria-hidden="true" /> Juego
              </div>
              <div className="option-grid option-grid-compact">
                {tcgOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTournamentTCG(tournamentId, opt.value)}
                    className={tcg === opt.value ? 'option-pill active' : 'option-pill'}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-control-block">
              <div className="setup-block-title">
                <i className="ti ti-users-group" aria-hidden="true" /> Modalidad
              </div>
              <div className="option-grid option-grid-tight">
                {teamModeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setTournamentTeamMode(tournamentId, option.value)}
                    className={teamMode === option.value ? 'option-pill option-pill-stacked active' : 'option-pill option-pill-stacked'}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.shortLabel}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-control-block">
              <div className="setup-block-title">
                <i className="ti ti-brackets" aria-hidden="true" /> Estructura
              </div>
              <div className="option-grid option-grid-tight">
                {phaseModeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setTournamentPhaseMode(tournamentId, option.value)}
                    className={phaseMode === option.value ? 'option-pill option-pill-stacked active' : 'option-pill option-pill-stacked'}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.shortLabel}</span>
                  </button>
                ))}
              </div>
              {phaseMode === 'swiss-top' && (
                <label className="setup-inline-number">
                  <span>Corte de Top</span>
                  <input
                    type="number"
                    min={2}
                    max={128}
                    step={1}
                    value={topCut}
                    onChange={event => setTournamentTopCut(tournamentId, Number(event.target.value))}
                    style={inputStyle}
                  />
                </label>
              )}
            </section>
          </div>

          <div className="setup-hint-strip">
            <span><i className="ti ti-info-circle" aria-hidden="true" /> {selectedTeamMode?.description}</span>
            <span>{selectedPhaseMode?.description}</span>
            {tcg === 'yugioh' && <span>YuGiOh: sin empates; al acabar tiempo ambos jugadores pierden.</span>}
            {tcg === 'magic' && <span>Magic: el formato elegido se usara en el constructor de mazos.</span>}
            {tcg === 'chess' && <span>Ajedrez: sin constructor de mazos; solo emparejamientos y resultados.</span>}
          </div>
        </div>

        <div className="setup-two-column setup-compact-settings">
          {tcg === 'magic' && (
            <div className="setup-card" style={cardStyle}>
              <div style={cardTitleStyle}>
                <i className="ti ti-stack-2" aria-hidden="true" /> Formato de Magic
              </div>
              <div className="option-grid option-grid-compact">
                {magicFormatOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setTournamentMagicFormat(tournamentId, option.value)}
                    className={magicFormat === option.value ? 'option-pill active' : 'option-pill'}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="setup-note">
                <i className="ti ti-info-circle" aria-hidden="true" /> {selectedMagicFormat?.description}
              </div>
            </div>
          )}

          <div className="setup-card" style={cardStyle}>
            <div style={cardTitleStyle}>
              <i className="ti ti-clock" aria-hidden="true" /> Duracion de ronda
            </div>
            <div className="option-grid option-grid-tight">
              {timerOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimerDuration(tournamentId, opt.value)}
                  className={timerDuration === opt.value ? 'option-pill active' : 'option-pill'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-card" style={cardStyle}>
            <div style={cardTitleStyle}>
              <i className="ti ti-scale" aria-hidden="true" /> Desempates
            </div>
            <select
              value={tiebreakerSystem}
              onChange={event => setTiebreakerSystem(tournamentId, event.target.value as TournamentTiebreakerSystem)}
              style={inputStyle}
            >
              {tiebreakerSystemOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div className="setup-note">
              <i className="ti ti-info-circle" aria-hidden="true" /> {selectedTiebreaker?.description}
            </div>
          </div>
        </div>

        <PlayerList tournamentId={tournamentId} />
      </section>

      <aside className="setup-side-column">
        <div className="setup-card setup-summary-card" style={cardStyle}>
          <div className="setup-card-header">
            <div style={cardTitleStyle}>
              <i className="ti ti-chart-bar" aria-hidden="true" /> Resumen operativo
            </div>
            <span>{playerCount >= 2 ? 'Listo para iniciar' : `Faltan ${2 - playerCount} ${teamMode === 'solo' ? 'jugador' : 'equipo'}`}</span>
          </div>
          <div className="setup-summary-grid">
            <SummaryCell label={participantLabel} value={playerCount} />
            <SummaryCell label="Rondas" value={playerCount >= 2 ? totalRounds : '-'} />
            <SummaryCell label="Min" value={Math.floor(timerDuration / 60)} />
            <SummaryCell label="Top" value={phaseMode === 'swiss-top' ? topCut : 'No'} />
          </div>
          <div className="setup-summary-list">
            <SummaryRow label="Juego" value={tcg === 'magic' ? `${selectedGame?.label ?? 'Magic'} · ${selectedMagicFormat?.label}` : selectedGame?.label ?? 'TCG'} />
            <SummaryRow label="Modalidad" value={selectedTeamMode?.label ?? 'Normal'} />
            <SummaryRow label="Estructura" value={selectedPhaseMode?.label ?? 'Suizo'} />
            <SummaryRow label="Desempate" value={selectedTiebreaker?.label ?? 'Por defecto'} />
          </div>
        </div>

        <div className="setup-card invite-card" style={cardStyle}>
          <div className="invite-card-header">
            <div>
              <div style={cardTitleStyle}>
                <i className="ti ti-qrcode" aria-hidden="true" /> Participacion
              </div>
              <p>Escanea para inscribirse y reportar resultados.</p>
            </div>
          </div>

          <div className="invite-qr-wrap">
            <QRCodeSVG
              value={invitationLink}
              size={208}
              level="M"
              marginSize={3}
              bgColor="#ffffff"
              fgColor="#05070c"
            />
          </div>

          <div className="invite-actions">
            <input
              readOnly
              value={invitationLink}
              style={inputStyle}
              aria-label="Enlace de invitacion"
            />
            <div className="invite-action-buttons">
              <button onClick={copyInvitation} style={buttonStyle} title="Copia el enlace de inscripcion al portapapeles">
                <i className="ti ti-copy" aria-hidden="true" /> Copiar enlace
              </button>
              <button onClick={shareInvitation} style={buttonStyle} title="Comparte el enlace con apps del movil">
                <i className="ti ti-share-3" aria-hidden="true" /> Compartir enlace
              </button>
              <button onClick={openQrTab} style={buttonStyle} title="Abre el QR grande para proyectar o imprimir">
                <i className="ti ti-external-link" aria-hidden="true" /> Mostrar QR grande
              </button>
            </div>
          </div>

          <div
            className="invite-status"
            style={{
              color: !firebaseConfigured
                ? 'var(--color-text-warning)'
                : inviteStatus
                  ? 'var(--color-accent-secondary)'
                  : 'var(--color-text-secondary)',
            }}
          >
            {!firebaseConfigured
              ? 'Firebase no esta configurado: el enlace publico no podra cargar el torneo.'
              : inviteStatus || 'Listo para moviles de jugadores.'}
          </div>
        </div>

        {error && (
          <div className="setup-error">
            <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={playerCount < 2}
          className="start-tournament-button"
        >
          <i className="ti ti-player-play" aria-hidden="true" />
          Comenzar torneo (ronda 1)
        </button>
      </aside>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="setup-summary-cell">
      <div>{value}</div>
      <span>{label}</span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="setup-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '.85rem 1rem',
  marginBottom: '.65rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.55rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: '13px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
}

