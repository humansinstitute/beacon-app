import express from "express";
import {
  sendMessage,
  isClientReady,
} from "../../workers/gateways/whatsapp.gateway.worker.js";
import { BeaconMessage } from "../../../models/index.js";
import mongoose from "mongoose";

const router = express.Router();

router.post("/signal", (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

router.post("/wa", async (req, res) => {
  if (!isClientReady()) {
    return res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message:
        "WhatsApp client not authenticated or not ready. Please scan the QR code in the worker logs and try again.",
    });
  }

  const { chatID, content, options, beaconMessageID } = req.body;

  // Validate beaconMessageID
  if (!mongoose.Types.ObjectId.isValid(beaconMessageID)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "Invalid beaconMessageID format",
    });
  }

  try {
    const result = await sendMessage(chatID, content, options);
    if (!result || !result.success || !result.messageID) {
      throw new Error("Failed to send message");
    }
    const response = {
      content,
      role: "agent",
      messageID: result.messageID,
      replyTo: options?.quotedMessageId || null,
      ts: Math.floor(Date.now() / 1000),
    };
    await BeaconMessage.findByIdAndUpdate(
      beaconMessageID,
      { response },
      { new: true }
    );
    res
      .status(200)
      .json({ messageID: result.messageID, timestamp: response.ts });
  } catch (err) {
    console.error("WA gateway error:", err);
    res.status(500).json({
      error: "MESSAGE_SEND_FAILED",
      message: err.message,
    });
  }
});

export default router;
