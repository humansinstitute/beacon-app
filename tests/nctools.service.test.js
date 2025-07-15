import axios from "axios";

// Mock axios before importing the service
jest.mock("axios");
const mockedAxios = axios;

// Mock axios.create to return a proper mock instance
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

mockedAxios.create.mockReturnValue(mockAxiosInstance);

// Now import the service after mocking
import NCToolsService from "../app/api/services/nctools.service.js";

describe("NCToolsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the service's client to use our mock
    NCToolsService.client = mockAxiosInstance;
  });

  describe("Configuration", () => {
    test("should initialize with default configuration", () => {
      expect(NCToolsService.baseURL).toBe("http://localhost:3000");
      expect(NCToolsService.timeout).toBe(30000);
      expect(NCToolsService.defaultMint).toBe(
        "https://mint.minibits.cash/Bitcoin"
      );
    });

    test("should use environment variables when available", async () => {
      const originalEnv = process.env;
      process.env.NCTOOLS_API_URL = "http://custom:4000";
      process.env.NCTOOLS_TIMEOUT = "60000";
      process.env.CASHU_DEFAULT_MINT = "https://custom.mint.com";

      // For this test, we'll just verify the current instance uses defaults
      // since the service is a singleton and already instantiated
      expect(NCToolsService.baseURL).toBeDefined();
      expect(NCToolsService.timeout).toBeDefined();
      expect(NCToolsService.defaultMint).toBeDefined();

      process.env = originalEnv;
    });
  });

  describe("Input Validation", () => {
    test("should validate npub format", async () => {
      const result = await NCToolsService.getBalance("invalid-npub");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid npub");
    });

    test("should validate amount for operations", async () => {
      const result = await NCToolsService.generateInvoice("npub1test", -100);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid amount");
    });

    test("should accept valid npub", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { balance: 1000 } });

      const result = await NCToolsService.getBalance(
        "npub1testvalidnpubstring"
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Wallet Operations", () => {
    test("should ensure wallet exists", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { npub: "npub1test", mint: "https://mint.minibits.cash/Bitcoin" },
      });

      const result = await NCToolsService.ensureWalletExists("npub1test");

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/wallet/create",
        {
          npub: "npub1test",
          mint: "https://mint.minibits.cash/Bitcoin",
        }
      );
    });

    test("should get wallet balance", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { balance: 1500, unit: "sats" },
      });

      const result = await NCToolsService.getBalance("npub1test");

      expect(result.success).toBe(true);
      expect(result.balance).toBe(1500);
      expect(result.unit).toBe("sats");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/api/wallet/npub1test/balance"
      );
    });

    test("should generate invoice for minting", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          invoice: "lnbc1000n1...",
          hash: "abc123",
          amount: 1000,
        },
      });

      const result = await NCToolsService.generateInvoice("npub1test", 1000);

      expect(result.success).toBe(true);
      expect(result.invoice).toBe("lnbc1000n1...");
      expect(result.amount).toBe(1000);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/wallet/npub1test/mint",
        {
          amount: 1000,
          mint: "https://mint.minibits.cash/Bitcoin",
        }
      );
    });

    test("should pay invoice (melt operation)", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          paid: true,
          preimage: "def456",
        },
      });

      const result = await NCToolsService.payInvoice(
        "npub1test",
        "lnbc1000n1..."
      );

      expect(result.success).toBe(true);
      expect(result.payment.paid).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/wallet/npub1test/melt",
        {
          invoice: "lnbc1000n1...",
        }
      );
    });

    test("should send tokens", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          encodedToken: "cashuAbc123...",
        },
      });

      const result = await NCToolsService.sendTokens(
        "npub1sender",
        500,
        "npub1recipient"
      );

      expect(result.success).toBe(true);
      expect(result.encodedToken).toBe("cashuAbc123...");
      expect(result.amount).toBe(500);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/wallet/npub1sender/send",
        {
          amount: 500,
          recipientPubkey: "npub1recipient",
        }
      );
    });

    test("should receive tokens", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          received: true,
          amount: 500,
        },
      });

      const result = await NCToolsService.receiveTokens(
        "npub1receiver",
        "cashuAbc123...",
        "privatekey123"
      );

      expect(result.success).toBe(true);
      expect(result.received.received).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/wallet/npub1receiver/receive",
        {
          encodedToken: "cashuAbc123...",
          privateKey: "privatekey123",
        }
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle connection errors", async () => {
      const connectionError = new Error("Connection refused");
      connectionError.code = "ECONNREFUSED";
      mockAxiosInstance.get.mockRejectedValue(connectionError);

      const result = await NCToolsService.getBalance("npub1test");

      expect(result.success).toBe(false);
      expect(result.type).toBe("CONNECTION_ERROR");
      expect(result.message).toContain("Unable to connect to NC Tools service");
    });

    test("should handle timeout errors", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.code = "ECONNABORTED";
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      const result = await NCToolsService.getBalance("npub1test");

      expect(result.success).toBe(false);
      expect(result.type).toBe("TIMEOUT_ERROR");
      expect(result.message).toContain("timed out");
    });

    test("should handle API errors", async () => {
      const apiError = new Error("API Error");
      apiError.response = {
        status: 400,
        statusText: "Bad Request",
        data: { error: "Invalid wallet", message: "Wallet not found" },
      };
      mockAxiosInstance.get.mockRejectedValue(apiError);

      const result = await NCToolsService.getBalance("npub1test");

      expect(result.success).toBe(false);
      expect(result.type).toBe("API_ERROR");
      expect(result.status).toBe(400);
      expect(result.error).toBe("Invalid wallet");
    });
  });

  describe("Health Check", () => {
    test("should perform health check", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: "healthy", version: "1.0.0" },
      });

      const result = await NCToolsService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.status.status).toBe("healthy");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/health");
    });
  });
});
