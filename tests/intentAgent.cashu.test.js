import intentAgent from "../app/src/agents/intentAgent.js";

describe("IntentAgent - Cashu Intent Classification", () => {
  const mockContext = "Test context";
  const mockHistory = [];

  describe("Cashu Intent Detection", () => {
    test("should include cashu in intent options", async () => {
      const result = await intentAgent(
        "check bitcoin balance",
        mockContext,
        mockHistory
      );
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("cashu");
      expect(systemPrompt).toContain(
        "conversation | research | publish | settings | cashu"
      );
    });

    test("should include Bitcoin/Cashu keywords in system prompt", async () => {
      const result = await intentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("bitcoin");
      expect(systemPrompt).toContain("sats");
      expect(systemPrompt).toContain("lightning");
      expect(systemPrompt).toContain("invoice");
      expect(systemPrompt).toContain("payment");
      expect(systemPrompt).toContain("balance");
      expect(systemPrompt).toContain("wallet");
      expect(systemPrompt).toContain("cashu");
      expect(systemPrompt).toContain("pay");
      expect(systemPrompt).toContain("send");
      expect(systemPrompt).toContain("receive");
      expect(systemPrompt).toContain("lnbc");
    });

    test("should handle Bitcoin-related messages", async () => {
      const bitcoinMessages = [
        "check my bitcoin balance",
        "how many sats do I have",
        "pay this lightning invoice",
        "create an invoice for 1000 sats",
        "send bitcoin to alice",
        "what is my wallet balance",
        "pay lnbc1000...",
        "receive payment",
      ];

      for (const message of bitcoinMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("cashu");
      }
    });

    test("should handle Cashu-specific messages", async () => {
      const cashuMessages = [
        "cashu balance check",
        "send cashu tokens",
        "receive cashu payment",
        "cashu wallet status",
      ];

      for (const message of cashuMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("cashu");
      }
    });

    test("should handle Lightning Network messages", async () => {
      const lightningMessages = [
        "pay lightning invoice",
        "create lightning invoice",
        "lightning payment",
        "lnbc invoice payment",
      ];

      for (const message of lightningMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("lightning");
      }
    });
  });

  describe("Non-Cashu Intent Preservation", () => {
    test("should still handle conversation intent", async () => {
      const conversationMessages = [
        "hello there",
        "how are you today",
        "tell me a joke",
        "what is the weather like",
      ];

      for (const message of conversationMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("conversation");
      }
    });

    test("should still handle research intent", async () => {
      const researchMessages = [
        "what is the capital of France",
        "research the latest news about AI",
        "look up information about climate change",
        "find data about renewable energy",
      ];

      for (const message of researchMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("research");
      }
    });

    test("should still handle publish intent", async () => {
      const publishMessages = [
        "publish this message to nostr",
        "post this to nostr",
        "share this on nostr",
        "broadcast this message",
      ];

      for (const message of publishMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("publish");
      }
    });

    test("should still handle settings intent", async () => {
      const settingsMessages = [
        "change my account settings",
        "update my beacon preferences",
        "modify my profile",
        "account configuration",
      ];

      for (const message of settingsMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("settings");
      }
    });
  });

  describe("Agent Configuration", () => {
    test("should maintain proper agent structure with cashu intent", async () => {
      const result = await intentAgent(
        "bitcoin balance",
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
      expect(result.model.callType).toBe("Set Intent for a conversation");
      expect(result.model.type).toBe("json_object");
      expect(result.model.temperature).toBe(0.5);
    });

    test("should have correct JSON response format in system prompt", async () => {
      const result = await intentAgent("test", mockContext, mockHistory);
      const systemPrompt = result.chat.systemPrompt;

      expect(systemPrompt).toContain("reasoning:");
      expect(systemPrompt).toContain("intent:");
      expect(systemPrompt).toContain("confidence:");
    });
  });

  describe("Edge Cases with Cashu Intent", () => {
    test("should handle mixed intent messages", async () => {
      const mixedMessages = [
        "research bitcoin prices and check my balance",
        "publish this message about my bitcoin payment",
        "change settings for my bitcoin wallet",
        "tell me about bitcoin and show my sats",
      ];

      for (const message of mixedMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        // Should still include cashu in options
        expect(result.chat.systemPrompt).toContain("cashu");
      }
    });

    test("should handle case-insensitive Bitcoin keywords", async () => {
      const caseMessages = [
        "BITCOIN balance",
        "Bitcoin Payment",
        "SATS transfer",
        "Lightning Invoice",
      ];

      for (const message of caseMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        expect(result.chat.systemPrompt).toContain("cashu");
      }
    });

    test("should handle Bitcoin abbreviations", async () => {
      const abbreviationMessages = [
        "BTC balance",
        "btc payment",
        "LN invoice",
        "ln payment",
      ];

      for (const message of abbreviationMessages) {
        const result = await intentAgent(message, mockContext, mockHistory);
        expect(result.chat.userPrompt).toBe(message);
        // System prompt should contain the keywords for detection
        expect(result.chat.systemPrompt).toContain("bitcoin");
      }
    });
  });

  describe("Message Sanitization with Cashu Content", () => {
    test("should sanitize Bitcoin messages with special characters", async () => {
      const specialMessage =
        'Pay "lightning" invoice\nfor 1000 sats\\with quotes';
      const result = await intentAgent(
        specialMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(
        'Pay \\"lightning\\" invoice\\nfor 1000 sats\\\\with quotes'
      );
    });

    test("should handle Lightning invoices with special characters", async () => {
      const invoiceMessage = 'Pay this: lnbc1000n1p"test"\\invoice';
      const result = await intentAgent(
        invoiceMessage,
        mockContext,
        mockHistory
      );

      expect(result.chat.userPrompt).toBe(
        'Pay this: lnbc1000n1p\\"test\\"\\\\invoice'
      );
    });
  });
});
