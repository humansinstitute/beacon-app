import cashuIntentAgent from "../app/src/agents/cashuIntentAgent.js";

describe("CashuIntentAgent", () => {
  const mockContext = "Test context";
  const mockHistory = [];

  describe("Agent Structure", () => {
    test("should return proper call details structure", async () => {
      const result = await cashuIntentAgent(
        "check balance",
        mockContext,
        mockHistory
      );

      expect(result).toHaveProperty("callID");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("chat");
      expect(result).toHaveProperty("origin");

      // Check model configuration
      expect(result.model.provider).toBe("groq");
      expect(result.model.model).toBe(
        "meta-llama/llama-4-scout-17b-16e-instruct"
      );
      expect(result.model.callType).toBe("Cashu Operation Classification");
      expect(result.model.type).toBe("json_object");
      expect(result.model.temperature).toBe(0.3);

      // Check chat structure
      expect(result.chat).toHaveProperty("userPrompt");
      expect(result.chat).toHaveProperty("systemPrompt");
      expect(result.chat).toHaveProperty("messageContext");
      expect(result.chat).toHaveProperty("messageHistory");
    });

    test("should have UUID callID", async () => {
      const result = await cashuIntentAgent(
        "test message",
        mockContext,
        mockHistory
      );
      expect(result.callID).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("Message Sanitization", () => {
    test("should sanitize message with special characters", async () => {
      const messageWithSpecialChars =
        'Test "message" with\nspecial\tchars\\and quotes';
      const result = await cashuIntentAgent(
        messageWithSpecialChars,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(
        'Test \\"message\\" with\\nspecial\\tchars\\\\and quotes'
      );
    });

    test("should handle non-string messages", async () => {
      const result = await cashuIntentAgent(123, mockContext, mockHistory);
      expect(result.chat.userPrompt).toBe(123);
    });

    test("should handle empty messages", async () => {
      const result = await cashuIntentAgent("", mockContext, mockHistory);
      expect(result.chat.userPrompt).toBe("");
    });
  });

  describe("System Prompt Content", () => {
    test("should include all operation types in system prompt", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("balance");
      expect(systemPrompt).toContain("pay_invoice");
      expect(systemPrompt).toContain("receive_invoice");
      expect(systemPrompt).toContain("send_tokens");
      expect(systemPrompt).toContain("unknown");
    });

    test("should include parameter extraction rules", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("Lightning invoices");
      expect(systemPrompt).toContain("lnbc");
      expect(systemPrompt).toContain("sats");
      expect(systemPrompt).toContain("Recipients");
    });

    test("should include confidence scoring guidelines", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("90-100");
      expect(systemPrompt).toContain("70-89");
      expect(systemPrompt).toContain("50-69");
      expect(systemPrompt).toContain("30-49");
      expect(systemPrompt).toContain("10-29");
    });

    test("should include JSON response format", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain('"type"');
      expect(systemPrompt).toContain('"parameters"');
      expect(systemPrompt).toContain('"confidence"');
      expect(systemPrompt).toContain('"reasoning"');
    });
  });

  describe("Operation Type Examples", () => {
    test("should handle balance check messages", async () => {
      const balanceMessages = [
        "check my bitcoin balance",
        "how much bitcoin do I have",
        "show my wallet balance",
        "what is my balance",
        "balance check",
      ];

      for (const message of balanceMessages) {
        const result = await cashuIntentAgent(
          message,
          mockContext,
          mockHistory
        );
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("balance");
      }
    });

    test("should handle pay invoice messages", async () => {
      const payMessages = [
        "pay lnbc1000n1p3xnhl2pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w",
        "pay this invoice",
        "send payment for this invoice",
        "pay invoice lnbc500...",
      ];

      for (const message of payMessages) {
        const result = await cashuIntentAgent(
          message,
          mockContext,
          mockHistory
        );
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("pay_invoice");
      }
    });

    test("should handle receive invoice messages", async () => {
      const receiveMessages = [
        "create invoice for 5000 sats",
        "generate invoice",
        "I need an invoice for 1000 satoshis",
        "request payment of 2000 sats",
        "invoice for 500 sats",
      ];

      for (const message of receiveMessages) {
        const result = await cashuIntentAgent(
          message,
          mockContext,
          mockHistory
        );
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("receive_invoice");
      }
    });

    test("should handle send tokens messages", async () => {
      const sendMessages = [
        "send 1000 sats to alice",
        "transfer 500 satoshis to bob",
        "give 2000 sats to @charlie",
        "send bitcoin to dave",
        "transfer tokens to user123",
      ];

      for (const message of sendMessages) {
        const result = await cashuIntentAgent(
          message,
          mockContext,
          mockHistory
        );
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("send_tokens");
      }
    });
  });

  describe("Parameter Extraction Examples", () => {
    test("should include Lightning invoice extraction examples", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("lnbc1000n1p");
      expect(systemPrompt).toContain('"invoice": "lnbc1000n1p..."');
    });

    test("should include amount extraction examples", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain('"amount": 5000');
      expect(systemPrompt).toContain('"amount": 1000');
    });

    test("should include recipient extraction examples", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain('"recipient": "alice"');
    });
  });

  describe("Edge Cases", () => {
    test("should handle messages with multiple potential operations", async () => {
      const ambiguousMessage = "check balance and then send 1000 sats to alice";
      const result = await cashuIntentAgent(
        ambiguousMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(ambiguousMessage);
      expect(result.chat.systemPrompt).toContain("unknown");
    });

    test("should handle messages with unclear amounts", async () => {
      const unclearMessage = "send some bitcoin to bob";
      const result = await cashuIntentAgent(
        unclearMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(unclearMessage);
    });

    test("should handle messages with invalid Lightning invoices", async () => {
      const invalidInvoiceMessage = "pay this fake invoice: notarealInvoice123";
      const result = await cashuIntentAgent(
        invalidInvoiceMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(invalidInvoiceMessage);
    });

    test("should handle very long messages", async () => {
      const longMessage =
        "I want to check my bitcoin balance and then maybe send some sats to my friend alice but first I need to make sure I have enough and also create an invoice for someone else who owes me money from last week when we had dinner together and split the bill".repeat(
          3
        );
      const result = await cashuIntentAgent(
        longMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(longMessage);
    });
  });

  describe("Context and History Handling", () => {
    test("should pass context to chat object", async () => {
      const testContext =
        "User has been asking about Bitcoin for the last few messages";
      const result = await cashuIntentAgent(
        "check balance",
        testContext,
        mockHistory
      );

      expect(result.chat.messageContext).toBe(testContext);
    });

    test("should pass history to chat object", async () => {
      const testHistory = [
        { role: "user", content: "What is Bitcoin?" },
        { role: "assistant", content: "Bitcoin is a cryptocurrency..." },
      ];
      const result = await cashuIntentAgent(
        "check balance",
        mockContext,
        testHistory
      );

      expect(result.chat.messageHistory).toBe(testHistory);
    });

    test("should handle empty context and history", async () => {
      const result = await cashuIntentAgent("check balance", "", []);

      expect(result.chat.messageContext).toBe("");
      expect(result.chat.messageHistory).toEqual([]);
    });
  });

  describe("Model Configuration", () => {
    test("should use appropriate temperature for classification", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);

      // Lower temperature for more consistent classification
      expect(result.model.temperature).toBe(0.3);
    });

    test("should use json_object type for structured output", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);

      expect(result.model.type).toBe("json_object");
    });

    test("should use groq provider with llama model", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);

      expect(result.model.provider).toBe("groq");
      expect(result.model.model).toBe(
        "meta-llama/llama-4-scout-17b-16e-instruct"
      );
    });
  });

  describe("Origin Object", () => {
    test("should include all required origin fields", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);

      expect(result.origin).toHaveProperty("originID");
      expect(result.origin).toHaveProperty("callTS");
      expect(result.origin).toHaveProperty("channel");
      expect(result.origin).toHaveProperty("gatewayUserID");
      expect(result.origin).toHaveProperty("gatewayMessageID");
      expect(result.origin).toHaveProperty("gatewayReplyTo");
      expect(result.origin).toHaveProperty("gatewayNpub");
      expect(result.origin).toHaveProperty("response");
      expect(result.origin).toHaveProperty("webhook_url");
      expect(result.origin).toHaveProperty("conversationID");
      expect(result.origin).toHaveProperty("channelSpace");
      expect(result.origin).toHaveProperty("userID");
      expect(result.origin).toHaveProperty("billingID");
    });

    test("should have valid timestamp", async () => {
      const result = await cashuIntentAgent("test", mockContext, mockHistory);

      expect(result.origin.callTS).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});
