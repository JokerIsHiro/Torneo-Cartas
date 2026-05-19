import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTournamentsStore } from '../store/tournamentsStore'
import { useSwissPairings } from '../hooks/useSwissPairings'
import { PlayerList } from '../components/PlayerList'
import type { TournamentTCG } from '../types/tournament'
import { hasFirebaseConfig } from '../services/firebase'

// Pantalla de configuracion: nombre, juego, duracion, invitacion y jugadores.
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
  { label: 'One Piece', value: 'one-piece' },
]

export function Setup({ tournamentId }: SetupProps) {
  const { name, tcg, timerDuration, playerCount, exists } = useTournamentsStore(
    useShallow(s => {
      const t = s.tournaments.find(t => t.id === tournamentId)
      return {
        exists:       !!t,
        name:         t?.name          ?? '',
        tcg:          t?.tcg           ?? 'magic',
        timerDuration: t?.timerDuration ?? 50 * 60,
        playerCount:  t?.players.length ?? 0,
      }
    })
  )
  const updateTournamentName = useTournamentsStore(s => s.updateTournamentName)
  const setTournamentTCG     = useTournamentsStore(s => s.setTournamentTCG)
  const setTimerDuration     = useTournamentsStore(s => s.setTimerDuration)
  const startTournament      = useTournamentsStore(s => s.startTournament)
  const { totalRounds }      = useSwissPairings(tournamentId)
  const [error, setError]    = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const firebaseConfigured = hasFirebaseConfig()

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
    return `Invitación a ${name || 'torneo'} (${game}). Inscríbete aquí: ${getInvitationLink()}`
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(getInvitationText())
    setInviteStatus('Invitación copiada')
    window.setTimeout(() => setInviteStatus(''), 1800)
  }

  async function shareInvitation() {
    const invitation = {
      title: name || 'Torneo',
      text: getInvitationText(),
      url: getInvitationLink(),
    }

    if (navigator.share) {
      await navigator.share(invitation)
      return
    }

    await copyInvitation()
  }

  return (
    <div>
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
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tcgOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTournamentTCG(tournamentId, opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                border: `0.5px solid ${tcg === opt.value ? 'var(--color-border-primary)' : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: tcg === opt.value ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                color: tcg === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: tcg === opt.value ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {tcg === 'yugioh' && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '.75rem' }}>
            <i className="ti ti-info-circle" aria-hidden="true" /> En YuGiOh no hay empate: victoria o derrota. Si se acaba el tiempo, ambos jugadores pierden.
          </div>
        )}
      </div>

      <div className="setup-card" style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-clock" aria-hidden="true" /> Duración de cada ronda
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {timerOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimerDuration(tournamentId, opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                border: `0.5px solid ${timerDuration === opt.value ? 'var(--color-border-primary)' : 'var(--color-border-tertiary)'}`,
                borderRadius: 'var(--border-radius-md)',
                background: timerDuration === opt.value ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                color: timerDuration === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontWeight: timerDuration === opt.value ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-card" style={cardStyle}>
        <div style={cardTitleStyle}>
          <i className="ti ti-send" aria-hidden="true" /> Invitación
        </div>
        <div className="invite-actions" style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: '8px',
          alignItems: 'center',
        }}>
          <input
            readOnly
            value={getInvitationLink()}
            style={inputStyle}
            aria-label="Enlace de invitación"
          />
          <button onClick={copyInvitation} style={buttonStyle}>
            <i className="ti ti-copy" aria-hidden="true" /> Copiar
          </button>
          <button onClick={shareInvitation} style={buttonStyle}>
            <i className="ti ti-share-3" aria-hidden="true" /> Enviar
          </button>
        </div>
        <div style={{
          minHeight: '18px',
          marginTop: '6px',
          fontSize: '12px',
          color: !firebaseConfigured
            ? 'var(--color-text-warning)'
            : inviteStatus
              ? 'var(--color-accent-secondary)'
              : 'var(--color-text-secondary)',
        }}>
          {!firebaseConfigured
            ? 'Firebase no esta configurado: el enlace publico no podra cargar el torneo.'
            : inviteStatus || 'Comparte este enlace para que puedan inscribirse al torneo.'}
        </div>
      </div>

      <PlayerList tournamentId={tournamentId} />

      {playerCount >= 2 && (
        <div style={{
          ...cardStyle,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-primary)',
          borderRadius: 'var(--border-radius-lg)',
          marginTop: '.75rem',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            textAlign: 'center',
          }}>
            <SummaryCell label="Jugadores"        value={playerCount} />
            <SummaryCell label="Rondas estimadas" value={totalRounds} />
            <SummaryCell label="Tiempo por ronda" value={`${Math.floor(timerDuration / 60)} min`} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-danger)', margin: '.5rem 0' }}>
          <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={playerCount < 2}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 500,
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          background: playerCount >= 2 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
          color: playerCount >= 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: playerCount >= 2 ? 'pointer' : 'not-allowed',
          opacity: playerCount < 2 ? 0.5 : 1,
          marginTop: '.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all .15s',
        }}
      >
        <i className="ti ti-player-play" aria-hidden="true" />
        Iniciar ronda 1
      </button>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{label}</div>
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
