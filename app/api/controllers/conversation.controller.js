import * as conversationService from "../services/conversation.service.js";

export async function getConversationHistory(req, res, next) {
  try {
    const { conversationId } = req.params;
    const history = await conversationService.getBeaconHistory(conversationId);
    res.json(history);
  } catch (error) {
    next(error);
  }
}

// Controller functions for Flow CRUD (Get by ID, Update, Update Action)
export async function getFlowById(req, res, next) {
  try {
    const { flowId } = req.params;
    const flow = await conversationService.getFlowById(flowId);
    if (!flow) {
      return res.status(404).json({ message: "Flow not found" });
    }
    res.json(flow);
  } catch (error) {
    next(error);
  }
}

export async function updateFlow(req, res, next) {
  try {
    const { flowId } = req.params;
    const updateData = req.body; // e.g., { type: "...", workflow: [...], state: "..." }
    const flow = await conversationService.updateFlow(flowId, updateData);
    if (!flow) {
      return res.status(404).json({ message: "Flow not found" });
    }
    res.json(flow);
  } catch (error) {
    next(error);
  }
}

export async function updateFlowAction(req, res, next) {
  try {
    const { flowId } = req.params;
    // req.body should contain the action details to update, e.g., { order: 1, output: "...", state: "..." }
    const actionData = req.body;
    const flow = await conversationService.updateFlowAction(flowId, actionData);
    if (!flow) {
      return res
        .status(404)
        .json({ message: "Flow not found or action not updated" });
    }
    res.json(flow);
  } catch (error) {
    next(error);
  }
}

// Controller functions for Conversation CRUD (Get by ID and Update)
export async function getConversationById(req, res, next) {
  try {
    const { conversationId } = req.params;
    const conversation = await conversationService.getConversationById(
      conversationId
    );
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function updateConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const updateData = req.body; // e.g., { summaryHistory: [...], history: [...] }
    const conversation = await conversationService.updateConversation(
      conversationId,
      updateData
    );
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}

// Controller functions for BeaconMessage CRUD
export async function createBeaconMessage(req, res, next) {
  try {
    const { messageData, originData, conversationRef, flowRef } = req.body;
    const beaconMessage = await conversationService.createBeaconMessage(
      messageData,
      originData,
      conversationRef,
      flowRef
    );
    res.status(201).json(beaconMessage);
  } catch (error) {
    next(error);
  }
}

export async function getBeaconMessageById(req, res, next) {
  try {
    const { messageId } = req.params;
    const beaconMessage = await conversationService.getBeaconMessageById(
      messageId
    );
    if (!beaconMessage) {
      return res.status(404).json({ message: "BeaconMessage not found" });
    }
    res.json(beaconMessage);
  } catch (error) {
    next(error);
  }
}

export async function updateBeaconMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const updateData = req.body; // e.g., { messageData: { ... }, originData: { ... } }
    const beaconMessage = await conversationService.updateBeaconMessage(
      messageId,
      updateData
    );
    if (!beaconMessage) {
      return res.status(404).json({ message: "BeaconMessage not found" });
    }
    res.json(beaconMessage);
  } catch (error) {
    next(error);
  }
}

export async function getLatestConversationFlow(req, res, next) {
  try {
    const { conversationId } = req.params;
    const flow = await conversationService.getLatestFlow(conversationId);
    res.json(flow);
  } catch (error) {
    next(error);
  }
}

export async function getFlowNextAction(req, res, next) {
  try {
    const { flowId } = req.params;
    const nextAction = await conversationService.getNextAction(flowId);
    res.json(nextAction);
  } catch (error) {
    next(error);
  }
}

export async function getRecentBeaconMessages(req, res, next) {
  try {
    const messages = await conversationService.getRecentMessages();
    res.json(messages);
  } catch (error) {
    next(error);
  }
}

export async function getMessagesByNpub(req, res, next) {
  try {
    const { npub, messagenumber } = req.params;

    // Validate messagenumber is a positive integer
    const messageCount = parseInt(messagenumber);
    if (isNaN(messageCount) || messageCount <= 0) {
      return res.status(400).json({
        message: "Message number must be a positive integer",
      });
    }

    const messages = await conversationService.getMessagesByNpub(
      npub,
      messageCount
    );
    res.json(messages);
  } catch (error) {
    next(error);
  }
}

export async function createNewConversation(req, res, next) {
  try {
    const { summaryHistory, history } = req.body;
    const conversation = await conversationService.createConversation(
      summaryHistory,
      history
    );
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function createNewFlow(req, res, next) {
  try {
    const { type, workflow, conversationRef } = req.body;
    const flow = await conversationService.createFlow(
      type,
      workflow,
      conversationRef
    );
    res.status(201).json(flow);
  } catch (error) {
    next(error);
  }
}

export async function addMessageToConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { flowId, messageData, originData } = req.body;
    const beaconMessage =
      await conversationService.addBeaconMessageToConversation(
        conversationId,
        flowId,
        messageData,
        originData
      );
    res.status(201).json(beaconMessage);
  } catch (error) {
    next(error);
  }
}

export async function updateConvActiveFlow(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { flowId } = req.body;
    const conversation = await conversationService.updateConversationActiveFlow(
      conversationId,
      flowId
    );
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}
