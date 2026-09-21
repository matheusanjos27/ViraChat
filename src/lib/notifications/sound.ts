/** Chime curto via Web Audio — sem arquivo externo. */

let sharedCtx: AudioContext | null = null;
let unlocked = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

/** Precisa de gesto do usuário (click) antes de tocar em browsers modernos. */
export function unlockNotificationAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    unlocked = true;
  });
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.12,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export async function playHandoffSound() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = true;
    const t0 = ctx.currentTime;
    // Duas notas rápidas — “ping-ping” de alerta
    tone(ctx, 880, t0, 0.14, 0.14);
    tone(ctx, 1175, t0 + 0.16, 0.18, 0.12);
  } catch {
    // Autoplay bloqueado até o usuário interagir com a página
  }
}

export function isNotificationAudioUnlocked() {
  return unlocked;
}
