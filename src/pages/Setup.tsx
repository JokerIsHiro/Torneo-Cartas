import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'
import type { TournamentTCG, TournamentTiebreakerSystem } from '../types/tournament'
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

export function Setup({ tournamentId }: SetupProps) {
  const { name, tcg, timerDuration, tiebreakerSystem, playerCount, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists: !!t,
        name: t?.name ?? '',
        tcg: t?.tcg ?? 'magic',
        timerDuration: t?.timerDuration ?? 50 * 60,
        tiebreakerSystem: t?.tiebreakerSystem ?? 'tcg-resistance',
        playerCount: t?.players.length ?? 0,
      }
    })
  )
  const updateTournamentName = useTournamentsStore(s => s.updateTournamentName)
  const setTournamentTCG = useTournamentsStore(s => s.setTournamentTCG)
  const setTimerDuration = useTournamentsStore(s => s.setTimerDuration)
  const setTiebreakerSystem = useTournamentsStore(s => s.setTiebreakerSystem)
  const startTournament = useTournamentsStore(s => s.startTournament)
  const { totalRounds } = useSwissPairings(tournamentId)
  const [error, setError] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const firebaseConfigured = hasFirebaseConfig()
  const invitationLink = getInvitationLink()

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
        <div className="setup-card" style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-tournament" aria-hidden="true" /> Nombre del torneo
          </div>
          <input
            type="text"
            value={name}
            onChange={e => updateTournamentName(tournamentId, e.target.value)}
            placeholder="Mi Torneo"
            style={inputStyle}
          />
        </div>

        <div className="setup-card" style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-cards" aria-hidden="true" /> Juego
          </div>
          <div className="option-grid">
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
          {tcg === 'yugioh' && (
            <div className="setup-note">
              <i className="ti ti-info-circle" aria-hidden="true" /> En YuGiOh no hay empate: victoria o derrota. Si se acaba el tiempo, ambos jugadores pierden.
            </div>
          )}
          {tcg === 'chess' && (
            <div className="setup-note">
              <i className="ti ti-info-circle" aria-hidden="true" /> En Ajedrez se usan emparejamientos, clasificacion y resultados; no se activa constructor de mazos.
            </div>
          )}
        </div>

        <div className="setup-card" style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-clock" aria-hidden="true" /> Duracion de cada ronda
          </div>
          <div className="option-grid">
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
            <i className="ti ti-scale" aria-hidden="true" /> Sistema de desempates
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
            <i className="ti ti-info-circle" aria-hidden="true" /> {tiebreakerSystemOptions.find(option => option.value === tiebreakerSystem)?.description}
          </div>
        </div>

        <PlayerList tournamentId={tournamentId} />
      </section>

      <aside className="setup-side-column">
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
              <button onClick={copyInvitation} style={buttonStyle}>
                <i className="ti ti-copy" aria-hidden="true" /> Copiar
              </button>
              <button onClick={shareInvitation} style={buttonStyle}>
                <i className="ti ti-share-3" aria-hidden="true" /> Enviar
              </button>
              <button onClick={openQrTab} style={buttonStyle}>
                <i className="ti ti-external-link" aria-hidden="true" /> Abrir QR
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

        <div className="setup-card" style={cardStyle}>
          <div style={cardTitleStyle}>
            <i className="ti ti-chart-bar" aria-hidden="true" /> Resumen
          </div>
          <div className="setup-summary-grid">
            <SummaryCell label="Jugadores" value={playerCount} />
            <SummaryCell label="Rondas" value={playerCount >= 2 ? totalRounds : '-'} />
            <SummaryCell label="Minutos" value={Math.floor(timerDuration / 60)} />
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
          Iniciar ronda 1
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

const cardStyle: React.CSSProperties = {
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '1rem 1.25rem',
  marginBottom: '.75rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '.75rem',
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
  padding: '8px 14px',
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
