let audioContext: AudioContext | null = null
let activeAlert: AudioNode[] = []
let activeStopTimeout: number | null = null

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

// Aviso de fin de ronda. No depende de archivos externos de audio.
export function playTimerFinishedSound() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') return

    stopTimerFinishedSound()

    const now = ctx.currentTime
    const alertDuration = 20
    const pulseEvery = 1.45

    for (let offset = 0; offset < alertDuration; offset += pulseEvery) {
      playDescendingAlarmPhrase(ctx, now + offset)
    }

    activeStopTimeout = window.setTimeout(stopTimerFinishedSound, alertDuration * 1000)
  } catch {
    // Audio is best-effort; timer behavior should never depend on sound playback.
  }
}

export function stopTimerFinishedSound() {
  if (activeStopTimeout !== null) {
    window.clearTimeout(activeStopTimeout)
    activeStopTimeout = null
  }

  activeAlert.forEach((node) => node.disconnect())
  activeAlert = []
}

function playDescendingAlarmPhrase(ctx: AudioContext, start: number) {
  playChime(ctx, start, 1047, 0.26)
  playChime(ctx, start + 0.3, 880, 0.26)
  playChime(ctx, start + 0.6, 698, 0.3)
  playChime(ctx, start + 0.96, 523, 0.42)
}

function playChime(ctx: AudioContext, start: number, frequency: number, duration: number) {
  playTone(ctx, start, frequency, duration, 'triangle', 0.28)
  playTone(ctx, start, frequency * 1.5, duration * 0.7, 'sine', 0.05)
}

function playTone(
  ctx: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect()
    gain.disconnect()
    activeAlert = activeAlert.filter((node) => node !== oscillator && node !== gain)
  })
  activeAlert.push(oscillator, gain)
}
