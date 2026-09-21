export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Opt-out: HANDOFF_TIMEOUT_SCHEDULER=0
  // Opt-in on non-production: HANDOFF_TIMEOUT_SCHEDULER=1
  const flag = process.env.HANDOFF_TIMEOUT_SCHEDULER;
  if (flag === "0") return;
  if (process.env.NODE_ENV !== "production" && flag !== "1") return;

  const { startHandoffTimeoutScheduler } = await import(
    "@/lib/handoff/scheduler"
  );
  startHandoffTimeoutScheduler();
}
