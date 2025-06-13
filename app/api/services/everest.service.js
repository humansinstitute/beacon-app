import fetch from "node-fetch";
import { createAdjustmentAndUpdateBalance } from "./adjustment.service.js";

/**
 * Calls the Everest agent API with the provided agent object and user context.
 * @param {Object} agent - The agent object containing prompt, history, content, etc.
 * @param {Object} userContext - The user context containing userID and userNpub.
 * @returns {Promise<Object>} - The response from the Everest API.
 */
async function callEverest(agent, userContext) {
  const baseUrl = process.env.EVEREST_API_BASE;
  const apiKey = process.env.EVEREST_API;
  const url = `${baseUrl.replace(/\/$/, "")}/v2/agent`;

  // DEBUG: Log agent data before JSON serialization to catch escaping issues
  console.log(
    "[Everest Service] DEBUG - Agent userPrompt preview:",
    agent.chat?.userPrompt?.substring(0, 200) + "..."
  );
  console.log(
    "[Everest Service] DEBUG - Agent userPrompt contains backslash:",
    agent.chat?.userPrompt?.includes("\\")
  );

  let requestBody;
  try {
    requestBody = JSON.stringify(agent);
    console.log("[Everest Service] DEBUG - JSON serialization successful");
  } catch (jsonError) {
    console.error(
      "[Everest Service] DEBUG - JSON serialization failed:",
      jsonError
    );
    throw new Error(`JSON serialization error: ${jsonError.message}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Everest API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const apiResponse = await response.json();

  // Debug logging
  console.log(
    "[Everest Service] API Response:",
    JSON.stringify(apiResponse, null, 2)
  );
  console.log("[Everest Service] User Context:", userContext);

  // Process usage costs if user context is provided
  if (userContext && apiResponse.usage && apiResponse.usage.costs) {
    const { userID, userNpub } = userContext;
    const totalCost = apiResponse.usage.costs.total;

    console.log("[Everest Service] Processing cost adjustment:", {
      userID,
      userNpub,
      totalCost,
      callID: apiResponse.callID,
    });

    try {
      const adjustment = await createAdjustmentAndUpdateBalance(
        userID,
        userNpub,
        {
          description: "Everest API call",
          refs: {
            beaconMessageId: apiResponse.callID,
          },
        },
        -totalCost
      );
      console.log(
        "[Everest Service] Cost adjustment created successfully:",
        adjustment._id
      );
    } catch (error) {
      console.error(
        "[Everest Service] Error processing cost adjustment:",
        error
      );
      throw error; // Re-throw to see the error in logs
    }
  } else {
    console.log("[Everest Service] Skipping cost processing:", {
      hasUserContext: !!userContext,
      hasUsage: !!apiResponse.usage,
      hasCosts: !!(apiResponse.usage && apiResponse.usage.costs),
      apiResponseKeys: Object.keys(apiResponse),
    });
  }

  return apiResponse;
}

export { callEverest };
