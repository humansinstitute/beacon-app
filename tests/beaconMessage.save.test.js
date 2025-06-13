// tests/beaconMessage.save.test.js
import { jest } from "@jest/globals";
import { connectDB } from "../libs/db.js";
import { BeaconMessage, Conversation } from "../models/index.js";

describe("BeaconMessage Save Test", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterEach(async () => {
    // Clean up test data
    await BeaconMessage.deleteMany({
      "message.messageID": { $regex: /^test_/ },
    });
    await Conversation.deleteMany({
      "summaryHistory.content": { $regex: /^Test message/ },
    });
  });

  test("should save BeaconMessage with proper origin.userNpub", async () => {
    // Create a test conversation first
    const conversation = new Conversation({
      history: [],
      summaryHistory: [
        {
          role: "user",
          content: "Test message for beacon save",
        },
      ],
      activeFlow: null,
    });
    await conversation.save();

    // Create a BeaconMessage with proper origin structure
    const beaconMessage = new BeaconMessage({
      message: {
        content: "Test message for beacon save",
        role: "user",
        messageID: "test_message_123",
        replyTo: null,
        ts: Math.floor(Date.now() / 1000),
      },
      response: {
        content: "Test response from beacon",
        role: "agent",
        messageID: "test_response_123",
        replyTo: "test_message_123",
        ts: Math.floor(Date.now() / 1000),
      },
      origin: {
        channel: "beacon.whatsapp",
        gatewayUserID: "61487097701@c.us",
        gatewayMessageID: "test_message_123",
        gatewayReplyTo: null,
        gatewayNpub: "npubpetesgateaytobereplacedlaterfornostrMQ",
        userNpub: "npub1testuser1234567890abcdef",
      },
      conversationRef: conversation._id,
      flowRef: null,
    });

    // Save the BeaconMessage
    const savedMessage = await beaconMessage.save();

    // Verify it was saved correctly
    expect(savedMessage._id).toBeDefined();
    expect(savedMessage.origin.userNpub).toBe("npub1testuser1234567890abcdef");
    expect(savedMessage.origin.gatewayNpub).toBe(
      "npubpetesgateaytobereplacedlaterfornostrMQ"
    );
    expect(savedMessage.conversationRef.toString()).toBe(
      conversation._id.toString()
    );

    // Verify we can retrieve it from the database
    const retrievedMessage = await BeaconMessage.findById(savedMessage._id);
    expect(retrievedMessage).toBeTruthy();
    expect(retrievedMessage.origin.userNpub).toBe(
      "npub1testuser1234567890abcdef"
    );

    console.log(
      "✅ BeaconMessage saved successfully with userNpub:",
      retrievedMessage.origin.userNpub
    );
  });

  test("should fail to save BeaconMessage without userNpub", async () => {
    const conversation = new Conversation({
      history: [],
      summaryHistory: [
        {
          role: "user",
          content: "Test message without userNpub",
        },
      ],
      activeFlow: null,
    });
    await conversation.save();

    // Create a BeaconMessage without userNpub (should fail)
    const beaconMessage = new BeaconMessage({
      message: {
        content: "Test message without userNpub",
        role: "user",
        messageID: "test_message_456",
        replyTo: null,
        ts: Math.floor(Date.now() / 1000),
      },
      origin: {
        channel: "beacon.whatsapp",
        gatewayUserID: "61487097701@c.us",
        gatewayMessageID: "test_message_456",
        gatewayReplyTo: null,
        gatewayNpub: "npubpetesgateaytobereplacedlaterfornostrMQ",
        // Missing userNpub field
      },
      conversationRef: conversation._id,
      flowRef: null,
    });

    // This should throw a validation error
    await expect(beaconMessage.save()).rejects.toThrow(/userNpub.*required/);
    console.log(
      "✅ BeaconMessage correctly failed validation without userNpub"
    );
  });
});
