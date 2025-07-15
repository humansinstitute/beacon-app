import { jest } from "@jest/globals";
import { processCashuPipeline } from "../app/src/pipeline/cashuInteraction.pipeline.js";

// Mock dependencies
jest.mock("../app/src/agents/cashuIntentAgent.js");
jest.mock("../app/api/services/everest.service.js");
jest.mock("../app/api/services/nctools.service.js");

import cashuIntentAgent from "../app/src/agents/cashuIntentAgent.js";
import { callEverest } from "../app/api/services/everest.service.js";
import ncToolsService from "../app/api/services/nctools.service.js";

describe("Cashu Interaction Pipeline", () => {
  let mockJobData;
  let mockUser;
  let mockBeaconMessage;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock user
    mockUser = {
      _id: "user123",
      npub: "npub1test123456789",
      name: "Test User",
    };

    // Setup mock beacon message
    mockBeaconMessage = {
      user: mockUser,
      message: {
        content: "check my balance",
        messageID: "msg123",
        role: "user",
      },
      origin: {
        gatewayUserID: "wa123",
        channel: "beacon.whatsapp",
      },
    };

    // Setup mock job data
    mockJobData = {
      beaconMessage: mockBeaconMessage,
      conversation: null,
    };

    // Setup default mocks
    ncToolsService.ensureWalletExists.mockResolvedValue({
      success: true,
      wallet: { npub: mockUser.npub },
      message: "Wallet ensured successfully",
    });

    cashuIntentAgent.mockResolvedValue({
      callID: "test-call-id",
      origin: {},
    });

    callEverest.mockResolvedValue({
      message: JSON.stringify({
        type: "balance",
        parameters: {},
        confidence: 95,
        reasoning: "Clear balance check request",
      }),
    });
  });

  describe("User Validation", () => {
    test("should return error when user npub is missing", async () => {
      mockJobData.beaconMessage.user = null;

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Unable to process Cashu request. Please ensure you're registered with the system."
      );
    });

    test("should return error when user object exists but npub is missing", async () => {
      mockJobData.beaconMessage.user = { _id: "user123", name: "Test User" };

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Unable to process Cashu request. Please ensure you're registered with the system."
      );
    });
  });

  describe("Wallet Management", () => {
    test("should ensure wallet exists before processing", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 1000,
        unit: "sats",
      });

      await processCashuPipeline(mockJobData);

      expect(ncToolsService.ensureWalletExists).toHaveBeenCalledWith(
        mockUser.npub
      );
    });

    test("should return error when wallet creation fails", async () => {
      ncToolsService.ensureWalletExists.mockResolvedValue({
        success: false,
        type: "CONNECTION_ERROR",
        message: "Unable to connect to NC Tools service",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ I'm sorry, Cashu services are currently down. Please try again later."
      );
    });
  });

  describe("Balance Check Operation", () => {
    beforeEach(() => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "balance",
          parameters: {},
          confidence: 95,
          reasoning: "Clear balance check request",
        }),
      });
    });

    test("should successfully check balance", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 1500,
        unit: "sats",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(ncToolsService.getBalance).toHaveBeenCalledWith(mockUser.npub);
      expect(result).toBe("💰 Your wallet balance is 1500 sats");
    });

    test("should handle balance check failure", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: false,
        type: "API_ERROR",
        status: 500,
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Unable to check your balance right now. Please try again later."
      );
    });
  });

  describe("Pay Invoice Operation", () => {
    beforeEach(() => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "pay_invoice",
          parameters: {
            invoice: "lnbc1000n1p3xnhl2pp5...",
          },
          confidence: 100,
          reasoning: "Lightning invoice detected for payment",
        }),
      });
    });

    test("should successfully pay valid invoice", async () => {
      ncToolsService.payInvoice.mockResolvedValue({
        success: true,
        payment: {
          amount: 1000,
          fee: 5,
        },
      });

      const result = await processCashuPipeline(mockJobData);

      expect(ncToolsService.payInvoice).toHaveBeenCalledWith(
        mockUser.npub,
        "lnbc1000n1p3xnhl2pp5..."
      );
      expect(result).toBe("✅ Payment sent! Paid 1000 sats. Fee: 5 sats");
    });

    test("should reject invalid invoice format", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "pay_invoice",
          parameters: {
            invoice: "invalid-invoice",
          },
          confidence: 50,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ That doesn't look like a valid Lightning invoice. Lightning invoices start with 'lnbc'."
      );
    });

    test("should return error when invoice parameter is missing", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "pay_invoice",
          parameters: {},
          confidence: 50,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Please provide a valid Lightning invoice to pay."
      );
    });

    test("should handle payment failure due to insufficient balance", async () => {
      ncToolsService.payInvoice.mockResolvedValue({
        success: false,
        type: "API_ERROR",
        status: 402,
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe("❌ Insufficient balance to pay this invoice.");
    });
  });

  describe("Generate Invoice Operation", () => {
    beforeEach(() => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "receive_invoice",
          parameters: {
            amount: 5000,
          },
          confidence: 90,
          reasoning: "Invoice creation request with specific amount",
        }),
      });
    });

    test("should successfully generate invoice", async () => {
      ncToolsService.generateInvoice.mockResolvedValue({
        success: true,
        invoice: "lnbc5000n1p3xnhl2pp5...",
        amount: 5000,
        hash: "payment-hash-123",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(ncToolsService.generateInvoice).toHaveBeenCalledWith(
        mockUser.npub,
        5000
      );
      expect(result).toContain("📄 Here's your invoice for 5000 sats:");
      expect(result).toContain("lnbc5000n1p3xnhl2pp5...");
    });

    test("should return error when amount parameter is missing", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "receive_invoice",
          parameters: {},
          confidence: 50,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Please specify an amount for the invoice (e.g., '1000 sats')."
      );
    });

    test("should handle invoice generation failure", async () => {
      ncToolsService.generateInvoice.mockResolvedValue({
        success: false,
        type: "API_ERROR",
        status: 500,
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Unable to generate invoice right now. Please try again later."
      );
    });
  });

  describe("Send Tokens Operation", () => {
    beforeEach(() => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "send_tokens",
          parameters: {
            amount: 1000,
            recipient: "alice",
          },
          confidence: 85,
          reasoning: "Send request with amount and recipient",
        }),
      });

      // Mock balance check for send operation
      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 2000,
        unit: "sats",
      });
    });

    test("should successfully send tokens", async () => {
      ncToolsService.sendTokens.mockResolvedValue({
        success: true,
        encodedToken: "cashu-token-encoded",
        amount: 1000,
        recipient: "alice",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(ncToolsService.getBalance).toHaveBeenCalledWith(mockUser.npub);
      expect(ncToolsService.sendTokens).toHaveBeenCalledWith(
        mockUser.npub,
        1000,
        "alice"
      );
      expect(result).toBe("✅ Sent 1000 sats successfully to alice");
    });

    test("should return error when amount parameter is missing", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "send_tokens",
          parameters: {
            recipient: "alice",
          },
          confidence: 50,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Please specify an amount to send (e.g., '1000 sats')."
      );
    });

    test("should return error when recipient parameter is missing", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "send_tokens",
          parameters: {
            amount: 1000,
          },
          confidence: 50,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe("❌ Please specify who you want to send tokens to.");
    });

    test("should check balance before sending and reject if insufficient", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 500, // Less than the 1000 sats to send
        unit: "sats",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Insufficient balance. You have 500 sats, but need 1000 sats."
      );
      expect(ncToolsService.sendTokens).not.toHaveBeenCalled();
    });

    test("should handle balance check failure during send", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: false,
        type: "CONNECTION_ERROR",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ Unable to check your balance. Please try again later."
      );
      expect(ncToolsService.sendTokens).not.toHaveBeenCalled();
    });
  });

  describe("Unknown Operation", () => {
    test("should handle unknown operation type", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "unknown",
          parameters: {},
          confidence: 30,
          reasoning: "Unclear operation type",
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toContain(
        "I understand you want to do something with Bitcoin/Cashu"
      );
      expect(result).toContain("Check balance: 'check my balance'");
    });

    test("should handle unrecognized operation type", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "unrecognized_type",
          parameters: {},
          confidence: 20,
        }),
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toContain(
        "I understand you want to do something with Bitcoin/Cashu"
      );
    });
  });

  describe("Conversation History Integration", () => {
    test("should include conversation history when available", async () => {
      mockJobData.conversation = {
        summaryHistory: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "check my balance" }, // Current message
        ],
      };

      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 1000,
        unit: "sats",
      });

      await processCashuPipeline(mockJobData);

      expect(cashuIntentAgent).toHaveBeenCalledWith(
        "check my balance",
        "The users name is: Test User.\n",
        [
          { role: "user", content: "hello" },
          { role: "assistant", content: "Hi there!" },
        ]
      );
    });

    test("should work without conversation history", async () => {
      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 1000,
        unit: "sats",
      });

      await processCashuPipeline(mockJobData);

      expect(cashuIntentAgent).toHaveBeenCalledWith(
        "check my balance",
        "The users name is: Test User.\n",
        []
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle JSON parsing errors from Everest response", async () => {
      callEverest.mockResolvedValue({
        message: "invalid json response",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ I'm having trouble understanding your Cashu request. Please try rephrasing it."
      );
    });

    test("should handle Everest service errors", async () => {
      callEverest.mockRejectedValue(new Error("Everest service unavailable"));

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ I'm sorry, Cashu services are currently experiencing issues. Please try again later."
      );
    });

    test("should handle cashu intent agent errors", async () => {
      cashuIntentAgent.mockRejectedValue(new Error("Agent error"));

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe(
        "❌ I'm sorry, Cashu services are currently experiencing issues. Please try again later."
      );
    });
  });

  describe("Response Formatting", () => {
    test("should format balance response correctly", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "balance",
          parameters: {},
          confidence: 95,
        }),
      });

      ncToolsService.getBalance.mockResolvedValue({
        success: true,
        balance: 0,
        unit: "sats",
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe("💰 Your wallet balance is 0 sats");
    });

    test("should format payment response with fee information", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "pay_invoice",
          parameters: {
            invoice: "lnbc1000n1p3xnhl2pp5...",
          },
          confidence: 100,
        }),
      });

      ncToolsService.payInvoice.mockResolvedValue({
        success: true,
        payment: {
          amount: 1000,
          fee: 0, // No fee
        },
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toBe("✅ Payment sent! Paid 1000 sats. Fee: 0 sats");
    });

    test("should format invoice response with instructions", async () => {
      callEverest.mockResolvedValue({
        message: JSON.stringify({
          type: "receive_invoice",
          parameters: {
            amount: 2500,
          },
          confidence: 90,
        }),
      });

      ncToolsService.generateInvoice.mockResolvedValue({
        success: true,
        invoice: "lnbc2500n1p3xnhl2pp5...",
        amount: 2500,
      });

      const result = await processCashuPipeline(mockJobData);

      expect(result).toContain("📄 Here's your invoice for 2500 sats:");
      expect(result).toContain("lnbc2500n1p3xnhl2pp5...");
      expect(result).toContain("Share this with someone to receive payment.");
    });
  });
});
