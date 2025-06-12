import conversationAgent from "../agents/conversationAgent.js";
import { callEverest } from "../../api/services/everest.service.js";

/**
 * Processes the conversation pipeline by calling the conversation agent and Everest API.
 * @param {Object} jobData - The job data containing the beacon message.
 * @returns {Promise<string>} The response message from Everest API.
 */
export async function processConversationPipeline(jobData) {
  console.log(jobData);
  const agentData = await conversationAgent(
    jobData.beaconMessage.message.content,
    "",
    []
  );
  agentData.origin = {
    ...agentData.origin,
    ...jobData.beaconMessage.origin,
  };
  const response = await callEverest(agentData);
  return response.message;
}
