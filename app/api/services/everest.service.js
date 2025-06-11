// Use ES Module import
import fetch from "node-fetch";

/**
 * Calls the Everest agent API with the provided agent object.
 * @param {Object} agent - The agent object containing prompt, history, content, etc.
 * @returns {Promise<Object>} - The response from the Everest API.
 */
async function callEverest(agent) {
  const baseUrl = process.env.EVEREST_API_BASE;
  const apiKey = process.env.EVEREST_API;
  const url = `${baseUrl.replace(/\/$/, "")}/v2/agent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(agent),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Everest API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

export { callEverest };
