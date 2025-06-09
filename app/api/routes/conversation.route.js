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

// BeaconMessage specific routes
// Create a new beacon message (potentially independent of a conversation initially)
router.post("/message", conversationController.createBeaconMessage);

// Get a specific beacon message by ID
router.get("/message/:messageId", conversationController.getBeaconMessageById);

// Update a specific beacon message by ID
router.patch("/message/:messageId", conversationController.updateBeaconMessage);

// Conversation specific routes (beyond the initial create)
// Get a specific conversation by ID
router.get("/:conversationId", conversationController.getConversationById);

// Update a specific conversation by ID
router.patch("/:conversationId", conversationController.updateConversation);

// Flow specific routes (beyond the initial create and get next action)
// Get a specific flow by ID
router.get("/flow/:flowId", conversationController.getFlowById);

// Update a specific flow by ID
router.patch("/flow/:flowId", conversationController.updateFlow);

// Update a specific action within a flow
router.patch("/flow/:flowId/action", conversationController.updateFlowAction);

export default router;
