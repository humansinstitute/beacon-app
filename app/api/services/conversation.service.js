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

/* BeaconMessage CRUD services */

/** Create a new BeaconMessage */
export async function createBeaconMessage(
  messageData,
  originData,
  conversationRef = null,
  flowRef = null
) {
  return BeaconMessage.create({
    message: messageData,
    origin: originData,
    conversationRef,
    flowRef,
  });
}

/** Get a BeaconMessage by its ID */
export async function getBeaconMessageById(messageId) {
  return BeaconMessage.findById(messageId).exec();
}

/** Update a BeaconMessage by its ID */
export async function updateBeaconMessage(messageId, updateData) {
  // updateData could be { messageData: { ... }, originData: { ... }, conversationRef: ..., flowRef: ... }
  // We need to construct the update object carefully based on what's provided in updateData
  const updatePayload = {};
  if (updateData.messageData) {
    // For nested objects like 'message', MongoDB needs dot notation for partial updates
    // or you replace the whole sub-document.
    // If you want to merge, you'd fetch, merge, then save.
    // For simplicity here, we'll assume full replacement of messageData if provided.
    updatePayload.message = updateData.messageData;
  }
  if (updateData.originData) {
    updatePayload.origin = updateData.originData;
  }
  if (updateData.conversationRef) {
    updatePayload.conversationRef = updateData.conversationRef;
  }
  if (updateData.flowRef) {
    updatePayload.flowRef = updateData.flowRef;
  }

  return BeaconMessage.findByIdAndUpdate(messageId, updatePayload, {
    new: true, // Return the updated document
  }).exec();
}

/* Flow CRUD services (Get by ID, Update, Update Action) */

/** Get a Flow by its ID */
export async function getFlowById(flowId) {
  return Flow.findById(flowId).exec();
}

/** Update a Flow by its ID */
export async function updateFlow(flowId, updateData) {
  // updateData could be { type, workflow, state, conversationRef }
  const updatePayload = {};
  if (updateData.type) {
    updatePayload.type = updateData.type;
  }
  if (updateData.workflow) {
    updatePayload.workflow = updateData.workflow;
  }
  if (updateData.state) {
    updatePayload.state = updateData.state;
  }
  if (updateData.conversationRef) {
    updatePayload.conversationRef = updateData.conversationRef;
  }
  // Add any other fields of Flow model that are updatable

  return Flow.findByIdAndUpdate(flowId, updatePayload, {
    new: true, // Return the updated document
  }).exec();
}

/** Update a specific action within a Flow's workflow */
export async function updateFlowAction(flowId, actionData) {
  // actionData should contain { order, output, state, etc. }
  const flow = await Flow.findById(flowId);
  if (!flow) {
    throw new Error("Flow not found");
  }

  const actionIndex = flow.workflow.findIndex(
    (step) => step.order === actionData.order
  );

  if (actionIndex === -1) {
    throw new Error("Action not found in workflow");
  }

  // Update the specific properties of the action
  Object.keys(actionData).forEach((key) => {
    if (key !== "order") {
      // 'order' is used for identification, not update here
      flow.workflow[actionIndex][key] = actionData[key];
    }
  });

  // Mark the workflow path as modified if Mongoose doesn't detect nested change
  flow.markModified("workflow");

  await flow.save();
  return flow;
}

/* Conversation CRUD services (Get by ID and Update) */

/** Get a Conversation by its ID */
export async function getConversationById(conversationId) {
  return Conversation.findById(conversationId).exec();
}

/** Update a Conversation by its ID */
export async function updateConversation(conversationId, updateData) {
  // updateData could be { summaryHistory: [...], history: [...], activeFlow: ... }
  // Construct the update object carefully
  const updatePayload = {};
  if (updateData.summaryHistory) {
    updatePayload.summaryHistory = updateData.summaryHistory;
  }
  if (updateData.history) {
    updatePayload.history = updateData.history;
  }
  if (updateData.activeFlow) {
    updatePayload.activeFlow = updateData.activeFlow;
  }
  // Add any other fields of Conversation model that are updatable

  return Conversation.findByIdAndUpdate(conversationId, updatePayload, {
    new: true, // Return the updated document
  }).exec();
}
