/**
 * In-process scheduler for VPS (`next start`).
 * Vercel uses vercel.json crons; Docker/VPS has no host crontab by default.
 */

import { processHandoffTimeouts } from "@/lib/handoff/timeout";

const TICK_MS = 60_000;
const FIRST_DELAY_MS = 20_000;

declare global {
  // eslint-disable-next-line no-var
  var __viraHandoffTimeoutSchedulerStarted: boolean | undefined;
}

export function startHandoffTimeoutScheduler() {
  if (globalThis.__viraHandoffTimeoutSchedulerStarted) return;
  globalThis.__viraHandoffTimeoutSchedulerStarted = true;

  console.info("[handoff-timeout] in-app scheduler started");

  const tick = async () => {
    try {
      const result = await processHandoffTimeouts();
      if (result.error) {
        console.error("[handoff-timeout] tick error", result.error);
      } else if (result.processed > 0) {
        console.info("[handoff-timeout] sent busy notice to", result.processed);
      }
    } catch (err) {
      console.error("[handoff-timeout] tick failed", err);
    }
  };

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, FIRST_DELAY_MS);
}
