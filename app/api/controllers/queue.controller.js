// app/api/controllers/queue.controller.js
import { addBeaconMessageToQueue } from "../services/queue.service.js";

export const addMessage = async (req, res) => {
  try {
    const { queueName } = req.params;
    const beaconMessage = req.body;

    if (!queueName) {
      return res.status(400).json({ error: "Queue name is required." });
    }

    // Basic validation: Check if beaconMessage exists and is not empty
    if (!beaconMessage || Object.keys(beaconMessage).length === 0) {
      return res
        .status(400)
        .json({ error: "Beacon message payload is required." });
    }

    // Optionally, add more specific validation for the beaconMessage structure if needed
    // For example: if (!beaconMessage.id || !beaconMessage.data) { ... }

    const result = await addBeaconMessageToQueue(queueName, beaconMessage);

    return res.status(201).json({
      message: `Beacon message successfully added to the '${queueName}' queue.`,
      jobId: result.jobId, // Include the jobId in the response
    });
  } catch (error) {
    console.error("Error in queue controller:", error);
    // Avoid sending detailed internal error messages to the client in production
    return res
      .status(500)
      .json({ error: "Internal server error processing your request." });
  }
};
