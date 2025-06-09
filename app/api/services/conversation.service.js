import { BeaconMessage, Conversation, Flow } from "../../../models/index.js";

/** 1. Get the latest flow for a conversation */
export async function getLatestFlow(conversationId) {
  return Flow.findOne({ conversationRef: conversationId })
    .sort({ createdAt: -1 }) // newest first
    .exec();
  // OR simply populate the pointer:
  // return Conversation.findById(conversationId).populate('activeFlow');
}

/** 2. Full beacon-message history for one conversation (oldest → newest) */
export function getBeaconHistory(conversationId) {
  return BeaconMessage.find({ conversationRef: conversationId })
    .sort({ "message.ts": 1 })
    .exec();
}

/** 3. Last 5 messages from the five most-recent *active* conversations */
export async function getRecentMessages() {
  const conversations = await Conversation.find({ activeFlow: { $ne: null } })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select("_id") // only need ids here
    .lean();

  const ids = conversations.map((c) => c._id);

  return BeaconMessage.find({ conversationRef: { $in: ids } })
    .sort({ "message.ts": -1 })
    .limit(5)
    .populate("conversationRef", "updatedAt") // light populate if needed
    .exec();
}

/** 4. Get the next action for a flow (first step still open, lowest order) */
export async function getNextAction(flowId) {
  const flow = await Flow.findById(flowId).lean();
  if (!flow) throw new Error("Flow not found");

  return (
    flow.workflow
      .filter((step) => step.state === "open")
      .sort((a, b) => a.order - b.order)[0] || null
  );
}

/* Insert / Update Functions */

export async function createConversation(summaryHistory = [], history = []) {
  return Conversation.create({
    summaryHistory,
    history,
  });
}

export async function createFlow(type, workflow, conversationRef) {
  return Flow.create({
    type,
    workflow,
    conversationRef,
  });
}

export async function addBeaconMessageToConversation(
  conversationId,
  flowId,
  messageData,
  originData
) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  const beacon = await BeaconMessage.create({
    message: messageData,
    origin: originData,
    conversationRef: conversationId,
    flowRef: flowId,
  });

  conversation.history.push(beacon._id);
  conversation.summaryHistory.push({
    role: messageData.role,
    content: messageData.content,
  });
  await conversation.save();
  return beacon;
}

export async function updateConversationActiveFlow(conversationId, flowId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error("Conversation not found");
  conversation.activeFlow = flowId;
  await conversation.save();
  return conversation;
}
