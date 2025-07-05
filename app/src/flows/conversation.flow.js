async function conversationFlow(beaconMessage, conversation) {
  // Receive the message being processed and the conversation object.

  // Build a flow object
  const flow = {
    id: "ref ID of flow",
    type: "research | websearch | conversation",
    workflow: [
      {
        order: 1,
        action: "callAgent",
        args: ["conversationAgent", "beaconMessage", "conversation"],
        output: NULL,
        exit: { field: "output", eval: "!=", value: "NULL" },
        state: open | complete,
        retries: 3,
      },
      {
        order: 2,
        action: "feedback to user",
        args: ["beaconMessage"],
        output: NULL,
        exit: { field: "output", eval: "!=", value: "NULL" },
        state: open | complete,
        retries: 3,
      },
    ],
    state: "description of current state of the flow", // This will be a description of the current status of the
    data: ["{ key: value }", "{ key: value }"], // Flexible array to record key values pairs as we go.
  };

  // console.log(callDetails);
  return flow;
}
export default conversationFlow;
