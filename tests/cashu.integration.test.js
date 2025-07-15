import intentAgent from "../app/src/agents/intentAgent.js";
import cashuIntentAgent from "../app/src/agents/cashuIntentAgent.js";

describe("Cashu Intent System Integration", () => {
  const mockContext = "Integration test context";
  const mockHistory = [];

  describe("Agent Import and Basic Functionality", () => {
    test("should import both agents successfully", () => {
      expect(intentAgent).toBeDefined();
      expect(typeof intentAgent).toBe("function");
      expect(cashuIntentAgent).toBeDefined();
      expect(typeof cashuIntentAgent).toBe("function");
    });

    test("should handle the complete flow for Bitcoin messages", async () => {
      const bitcoinMessage = "check my bitcoin balance";

      // Step 1: Intent classification should include cashu option
      const intentResult = await intentAgent(
        bitcoinMessage,
        mockContext,
        mockHistory
      );
      expect(intentResult.chat.systemPrompt).toContain("cashu");
      expect(intentResult.chat.userPrompt).toBe(bitcoinMessage);

      // Step 2: Cashu operation classification should work
      const cashuResult = await cashuIntentAgent(
        bitcoinMessage,
        mockContext,
        mockHistory
      );
      expect(cashuResult.chat.systemPrompt).toContain("balance");
      expect(cashuResult.chat.userPrompt).toBe(bitcoinMessage);
    });

    test("should handle Lightning invoice messages", async () => {
      const invoiceMessage =
        "pay lnbc1000n1p3xnhl2pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w";

      // Intent agent should recognize this as cashu-related
      const intentResult = await intentAgent(
        invoiceMessage,
        mockContext,
        mockHistory
      );
      expect(intentResult.chat.systemPrompt).toContain("lnbc");

      // Cashu agent should classify as pay_invoice
      const cashuResult = await cashuIntentAgent(
        invoiceMessage,
        mockContext,
        mockHistory
      );
      expect(cashuResult.chat.systemPrompt).toContain("pay_invoice");
    });
  });

  describe("Error Handling", () => {
    test("should handle null/undefined messages gracefully", async () => {
      // Intent agent
      const intentResult1 = await intentAgent(null, mockContext, mockHistory);
      expect(intentResult1.chat.userPrompt).toBe(null);

      const intentResult2 = await intentAgent(
        undefined,
        mockContext,
        mockHistory
      );
      expect(intentResult2.chat.userPrompt).toBe(undefined);

      // Cashu agent
      const cashuResult1 = await cashuIntentAgent(
        null,
        mockContext,
        mockHistory
      );
      expect(cashuResult1.chat.userPrompt).toBe(null);

      const cashuResult2 = await cashuIntentAgent(
        undefined,
        mockContext,
        mockHistory
      );
      expect(cashuResult2.chat.userPrompt).toBe(undefined);
    });

    test("should handle empty context and history", async () => {
      const message = "bitcoin balance";

      const intentResult = await intentAgent(message, "", []);
      expect(intentResult.chat.messageContext).toBe("");
      expect(intentResult.chat.messageHistory).toEqual([]);

      const cashuResult = await cashuIntentAgent(message, "", []);
      expect(cashuResult.chat.messageContext).toBe("");
      expect(cashuResult.chat.messageHistory).toEqual([]);
    });

    test("should handle very long messages", async () => {
      const longMessage = "bitcoin ".repeat(1000) + "balance check";

      const intentResult = await intentAgent(
        longMessage,
        mockContext,
        mockHistory
      );
      expect(intentResult.chat.userPrompt).toBe(longMessage);

      const cashuResult = await cashuIntentAgent(
        longMessage,
        mockContext,
        mockHistory
      );
      expect(cashuResult.chat.userPrompt).toBe(longMessage);
    });
  });

  describe("Agent Configuration Consistency", () => {
    test("should use consistent model configuration", async () => {
      const message = "bitcoin payment";

      const intentResult = await intentAgent(message, mockContext, mockHistory);
      const cashuResult = await cashuIntentAgent(
        message,
        mockContext,
        mockHistory
      );

      // Both should use groq provider
      expect(intentResult.model.provider).toBe("groq");
      expect(cashuResult.model.provider).toBe("groq");

      // Both should use the same model
      expect(intentResult.model.model).toBe(
        "meta-llama/llama-4-scout-17b-16e-instruct"
      );
      expect(cashuResult.model.model).toBe(
        "meta-llama/llama-4-scout-17b-16e-instruct"
      );

      // Both should use json_object type
      expect(intentResult.model.type).toBe("json_object");
      expect(cashuResult.model.type).toBe("json_object");
    });

    test("should have appropriate temperature settings", async () => {
      const message = "bitcoin payment";

      const intentResult = await intentAgent(message, mockContext, mockHistory);
      const cashuResult = await cashuIntentAgent(
        message,
        mockContext,
        mockHistory
      );

      // Intent agent uses 0.5 for general classification
      expect(intentResult.model.temperature).toBe(0.5);

      // Cashu agent uses 0.3 for more precise operation classification
      expect(cashuResult.model.temperature).toBe(0.3);
    });

    test("should have consistent origin structure", async () => {
      const message = "bitcoin payment";

      const intentResult = await intentAgent(message, mockContext, mockHistory);
      const cashuResult = await cashuIntentAgent(
        message,
        mockContext,
        mockHistory
      );

      // Both should have the same origin structure
      const intentOriginKeys = Object.keys(intentResult.origin).sort();
      const cashuOriginKeys = Object.keys(cashuResult.origin).sort();

      expect(intentOriginKeys).toEqual(cashuOriginKeys);
    });
  });

  describe("Message Sanitization Consistency", () => {
    test("should sanitize messages consistently", async () => {
      const specialMessage =
        'Pay "bitcoin" invoice\nwith 1000 sats\\and quotes';
      const expectedSanitized =
        'Pay \\"bitcoin\\" invoice\\nwith 1000 sats\\\\and quotes';

      const intentResult = await intentAgent(
        specialMessage,
        mockContext,
        mockHistory
      );
      const cashuResult = await cashuIntentAgent(
        specialMessage,
        mockContext,
        mockHistory
      );

      expect(intentResult.chat.userPrompt).toBe(expectedSanitized);
      expect(cashuResult.chat.userPrompt).toBe(expectedSanitized);
    });
  });

  describe("Real-world Message Examples", () => {
    test("should handle typical user requests", async () => {
      const realWorldMessages = [
        "What is my current bitcoin balance?",
        "I want to pay this lightning invoice: lnbc500n1...",
        "Create an invoice for 2000 sats please",
        "Send 1500 satoshis to my friend Alice",
        "How much bitcoin do I have in my wallet?",
        "Can you generate a payment request for 5000 sats?",
      ];

      for (const message of realWorldMessages) {
        // Both agents should handle these without errors
        const intentResult = await intentAgent(
          message,
          mockContext,
          mockHistory
        );
        const cashuResult = await cashuIntentAgent(
          message,
          mockContext,
          mockHistory
        );

        expect(intentResult).toHaveProperty("callID");
        expect(intentResult).toHaveProperty("model");
        expect(intentResult).toHaveProperty("chat");
        expect(intentResult).toHaveProperty("origin");

        expect(cashuResult).toHaveProperty("callID");
        expect(cashuResult).toHaveProperty("model");
        expect(cashuResult).toHaveProperty("chat");
        expect(cashuResult).toHaveProperty("origin");

        // Should have valid UUIDs
        expect(intentResult.callID).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(cashuResult.callID).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });
  });
});
