import { runAiForConversation } from "@/lib/ai/orchestrate";
import { AI_LIMITS } from "@/lib/ai/limits";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();
const needsRerun = new Set<string>();

/**
 * Coalesce rapid inbound messages: wait debounceMs, then run once.
 * If a run is already in flight, schedule a follow-up after it finishes.
 */
export function scheduleAiForConversation(conversationId: string) {
  const prev = timers.get(conversationId);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    timers.delete(conversationId);
    void execute(conversationId);
  }, AI_LIMITS.debounceMs);

  timers.set(conversationId, timer);
}

async function execute(conversationId: string) {
  if (running.has(conversationId)) {
    needsRerun.add(conversationId);
    return;
  }

  running.add(conversationId);
  try {
    await runAiForConversation(conversationId);
  } catch (err) {
    console.error("[ai] schedule error", conversationId, err);
  } finally {
    running.delete(conversationId);
    if (needsRerun.has(conversationId)) {
      needsRerun.delete(conversationId);
      scheduleAiForConversation(conversationId);
    }
  }
}
