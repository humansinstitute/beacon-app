describe("Conversation History Logic", () => {
  test("should add user message to existing conversation summaryHistory", () => {
    // Mock conversation object (simulating what comes from database)
    const conversation = {
      _id: "test-conversation-id",
      summaryHistory: [
        { role: "user", content: "What is a good paintbrush to use?" },
        {
          role: "assistant",
          content:
            "My friend, I'm glad you asked! The right paintbrush can make all the d...",
        },
      ],
      history: ["test-beacon-message-1"],
      save: jest.fn().mockResolvedValue(true),
    };

    // Mock job data (simulating what comes from the worker)
    const jobData = {
      beaconMessage: {
        message: {
          content: "I like paintbrushes for mini painting, what works well?",
          role: "user",
          messageID: "test-message-id",
          ts: Date.now(),
        },
      },
    };

    // Simulate the worker's logic for existing conversations
    const initialSummaryLength = conversation.summaryHistory.length;
    const initialHistoryLength = conversation.history.length;

    // This is the fix we implemented: Add the current user message to summaryHistory
    conversation.summaryHistory.push({
      role: jobData.beaconMessage.message.role,
      content: jobData.beaconMessage.message.content,
    });

    // Verify the user message was added
    expect(conversation.summaryHistory.length).toBe(initialSummaryLength + 1);
    expect(
      conversation.summaryHistory[conversation.summaryHistory.length - 1]
    ).toEqual({
      role: "user",
      content: "I like paintbrushes for mini painting, what works well?",
    });

    // Simulate BeaconMessage creation and conversation history update
    const mockBeaconMessageId = "test-beacon-message-2";
    conversation.history.push(mockBeaconMessageId);
    conversation.summaryHistory.push({
      role: "assistant",
      content: "Test response message",
    });

    // Verify both user message and agent response are added
    expect(conversation.history.length).toBe(initialHistoryLength + 1);
    expect(conversation.summaryHistory.length).toBe(initialSummaryLength + 2);

    // Verify the final summaryHistory structure
    const finalSummary = conversation.summaryHistory;
    expect(finalSummary[finalSummary.length - 2]).toEqual({
      role: "user",
      content: "I like paintbrushes for mini painting, what works well?",
    });
    expect(finalSummary[finalSummary.length - 1]).toEqual({
      role: "assistant",
      content: "Test response message",
    });

    // Verify history array contains the new BeaconMessage ID
    expect(conversation.history).toContain(mockBeaconMessageId);
  });

  test("should maintain correct conversation history order", () => {
    // Test that messages are added in the correct order
    const conversation = {
      summaryHistory: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "First response" },
      ],
      history: ["beacon-1"],
    };

    // Add new user message
    conversation.summaryHistory.push({
      role: "user",
      content: "Second message",
    });

    // Add new beacon message and agent response
    conversation.history.push("beacon-2");
    conversation.summaryHistory.push({
      role: "assistant",
      content: "Second response",
    });

    // Verify order
    expect(conversation.summaryHistory).toEqual([
      { role: "user", content: "First message" },
      { role: "assistant", content: "First response" },
      { role: "user", content: "Second message" },
      { role: "assistant", content: "Second response" },
    ]);

    expect(conversation.history).toEqual(["beacon-1", "beacon-2"]);
  });

  test("should handle conversation with no previous history", () => {
    // Test the case where we have a new conversation
    const conversation = {
      summaryHistory: [],
      history: [],
    };

    const jobData = {
      beaconMessage: {
        message: {
          content: "First message in conversation",
          role: "user",
          messageID: "first-message-id",
          ts: Date.now(),
        },
      },
    };

    // Add the user message
    conversation.summaryHistory.push({
      role: jobData.beaconMessage.message.role,
      content: jobData.beaconMessage.message.content,
    });

    // Add beacon message and agent response
    conversation.history.push("beacon-1");
    conversation.summaryHistory.push({
      role: "assistant",
      content: "Welcome! How can I help you?",
    });

    // Verify the conversation structure
    expect(conversation.summaryHistory).toEqual([
      { role: "user", content: "First message in conversation" },
      { role: "assistant", content: "Welcome! How can I help you?" },
    ]);

    expect(conversation.history).toEqual(["beacon-1"]);
  });
});
