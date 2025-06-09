import express from "express";
import * as conversationController from "../controllers/conversation.controller.js";

const router = express.Router();

// Get conversation history
router.get(
  "/:conversationId/history",
  conversationController.getConversationHistory
);

// Get latest flow for a conversation
router.get(
  "/:conversationId/flow/latest",
  conversationController.getLatestConversationFlow
);

// Get next action for a flow
router.get(
  "/flow/:flowId/next-action",
  conversationController.getFlowNextAction
);

// Get recent beacon messages (across multiple active conversations)
router.get("/messages/recent", conversationController.getRecentBeaconMessages);

// Create a new conversation
router.post("/", conversationController.createNewConversation);

// Create a new flow
router.post("/flow", conversationController.createNewFlow);

// Add a beacon message to a conversation
router.post(
  "/:conversationId/messages",
  conversationController.addMessageToConversation
);

// Update a conversation's active flow
router.patch(
  "/:conversationId/flow",
  conversationController.updateConvActiveFlow
);

export default router;
