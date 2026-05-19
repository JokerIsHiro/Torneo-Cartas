let audioContext: AudioContext | null = null

// Crea una unica instancia de AudioContext para todos los avisos sonoros.
function getAudioContext() {
  audioContext ??= new AudioContext()
  return audioContext
}

export async function unlockTimerSound() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // Browsers may block audio until a user gesture; the next interaction can unlock it.
  }
}

// Aviso corto de fin de ronda. No depende de archivos externos de audio.
export function playTimerFinishedSound() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') return

    const now = ctx.currentTime
    playTone(ctx, now, 880, 0.18)
    playTone(ctx, now + 0.24, 880, 0.18)
    playTone(ctx, now + 0.48, 660, 0.38)
  } catch {
    // Audio is best-effort; timer behavior should never depend on sound playback.
  }
}

function playTone(ctx: AudioContext, start: number, frequency: number, duration: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
}
