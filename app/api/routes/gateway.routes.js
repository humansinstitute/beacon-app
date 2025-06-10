import express from "express";
import { sendMessage } from "../../workers/gateways/whatsapp.gateway.worker.js";
import { BeaconMessage } from "../../../models/index.js";

const router = express.Router();

router.post("/signal", (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

router.post("/wa", async (req, res) => {
  const { chatID, content, options, beaconMessageID } = req.body;
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
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
