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
