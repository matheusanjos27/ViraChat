import assert from "node:assert/strict";

/** Mirrors src/lib/conversations/status.ts for a zero-dep smoke check. */
const canAiReply = (status) => status === "ai_active";
const canAgentReply = (status) => status === "human_active";
const transitions = {
  ai_active: ["waiting_human", "human_active", "resolved"],
  waiting_human: ["human_active", "resolved"],
  human_active: ["ai_active", "resolved"],
  resolved: ["ai_active"],
};
const canTransition = (from, to) => transitions[from].includes(to);

assert.equal(canAiReply("ai_active"), true);
assert.equal(canAiReply("human_active"), false);
assert.equal(canAgentReply("human_active"), true);
assert.equal(canAgentReply("waiting_human"), false);
assert.equal(canTransition("ai_active", "waiting_human"), true);
assert.equal(canTransition("waiting_human", "ai_active"), false);
assert.equal(canTransition("human_active", "ai_active"), true);
assert.equal(canTransition("resolved", "human_active"), false);

console.log("conversation status checks passed");
