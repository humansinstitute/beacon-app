import axios from "axios";

/**
 * NC Tools Service for Cashu wallet operations integration
 * Provides methods to interact with NC Tools API for eCash wallet functionality
 */
class NCToolsService {
  constructor() {
    this.baseURL = process.env.NCTOOLS_API_URL || "http://localhost:3000";
    this.timeout = parseInt(process.env.NCTOOLS_TIMEOUT) || 30000;
    this.defaultMint =
      process.env.CASHU_DEFAULT_MINT;

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request/response interceptors for logging (only if interceptors exist)
    if (this.client && this.client.interceptors) {
      this.client.interceptors.request.use(
        (config) => {
          console.log(
            `[NCTools Service] Request: ${config.method?.toUpperCase()} ${
              config.url
            }`
          );
          return config;
        },
        (error) => {
          console.error("[NCTools Service] Request error:", error);
          return Promise.reject(error);
        }
      );

      this.client.interceptors.response.use(
        (response) => {
          console.log(
            `[NCTools Service] Response: ${response.status} ${response.statusText}`
          );
          return response;
        },
        (error) => {
          console.error(
            "[NCTools Service] Response error:",
            error.response?.status,
            error.response?.statusText
          );
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Validates npub format
   * @param {string} npub - The npub to validate
   * @throws {Error} If npub is invalid
   */
  _validateNpub(npub) {
    if (!npub || typeof npub !== "string") {
      throw new Error("Invalid npub: must be a non-empty string");
    }
    if (!npub.startsWith("npub1")) {
      throw new Error("Invalid npub: must start with npub1");
    }
  }

  /**
   * Validates amount for operations
   * @param {number} amount - The amount to validate
   * @throws {Error} If amount is invalid
   */
  _validateAmount(amount) {
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }
  }

  /**
   * Handles API errors and returns structured error objects
   * @param {Error} error - The error to handle
   * @param {string} operation - The operation that failed
   * @returns {Object} Structured error object
   */
  _handleError(error, operation) {
    const errorInfo = {
      operation,
      timestamp: new Date().toISOString(),
      success: false,
    };

    if (error.code === "ECONNREFUSED") {
      errorInfo.error = "NC Tools API is not available";
      errorInfo.type = "CONNECTION_ERROR";
      errorInfo.message =
        "Unable to connect to NC Tools service. Please ensure it is running.";
    } else if (error.code === "ECONNABORTED") {
      errorInfo.error = "Request timeout";
      errorInfo.type = "TIMEOUT_ERROR";
      errorInfo.message = "Request to NC Tools API timed out";
    } else if (error.response) {
      errorInfo.error = error.response.data?.error || error.response.statusText;
      errorInfo.type = "API_ERROR";
      errorInfo.status = error.response.status;
      errorInfo.message =
        error.response.data?.message ||
        `NC Tools API returned ${error.response.status}`;
    } else {
      errorInfo.error = error.message;
      errorInfo.type = "UNKNOWN_ERROR";
      errorInfo.message = "An unexpected error occurred";
    }

    console.error(`[NCTools Service] ${operation} failed:`, errorInfo);
    return errorInfo;
  }

  /**
   * Ensures a wallet exists for the given npub, creates one if it doesn't exist
   * @param {string} npub - User's npub
   * @returns {Promise<Object>} Wallet creation result
   */
  async ensureWalletExists(npub) {
    try {
      this._validateNpub(npub);

      console.log(`[NCTools Service] Ensuring wallet exists for npub: ${npub}`);

      const response = await this.client.post("/api/wallet/create", {
        npub,
        mint: this.defaultMint,
      });

      return {
        success: true,
        wallet: response.data,
        message: "Wallet ensured successfully",
      };
    } catch (error) {
      return this._handleError(error, "ensureWalletExists");
    }
  }

  /**
   * Gets the balance for a wallet
   * @param {string} npub - User's npub
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(npub) {
    try {
      this._validateNpub(npub);

      console.log(`[NCTools Service] Getting balance for npub: ${npub}`);

      const response = await this.client.get(`/api/wallet/${npub}/balance`);

      return {
        success: true,
        balance: response.data.balance || 0,
        unit: response.data.unit || "sats",
        message: "Balance retrieved successfully",
      };
    } catch (error) {
      return this._handleError(error, "getBalance");
    }
  }

  /**
   * Generates a Lightning invoice for minting tokens
   * @param {string} npub - User's npub
   * @param {number} amount - Amount in satoshis
   * @returns {Promise<Object>} Invoice generation result
   */
  async generateInvoice(npub, amount) {
    try {
      this._validateNpub(npub);
      this._validateAmount(amount);

      console.log(
        `[NCTools Service] Generating invoice for npub: ${npub}, amount: ${amount}`
      );

      const response = await this.client.post(`/api/wallet/${npub}/mint`, {
        amount,
        mint: this.defaultMint,
      });

      return {
        success: true,
        invoice: response.data.invoice,
        amount,
        hash: response.data.hash,
        message: "Invoice generated successfully",
      };
    } catch (error) {
      return this._handleError(error, "generateInvoice");
    }
  }

  /**
   * Pays a Lightning invoice using wallet tokens (melt operation)
   * @param {string} npub - User's npub
   * @param {string} invoice - Lightning invoice to pay
   * @returns {Promise<Object>} Payment result
   */
  async payInvoice(npub, invoice) {
    try {
      this._validateNpub(npub);

      if (!invoice || typeof invoice !== "string") {
        throw new Error("Invalid invoice: must be a non-empty string");
      }

      console.log(`[NCTools Service] Paying invoice for npub: ${npub}`);

      const response = await this.client.post(`/api/wallet/${npub}/melt`, {
        invoice,
      });

      return {
        success: true,
        payment: response.data,
        message: "Invoice paid successfully",
      };
    } catch (error) {
      return this._handleError(error, "payInvoice");
    }
  }

  /**
   * Sends tokens to a recipient
   * @param {string} npub - Sender's npub
   * @param {number} amount - Amount to send in satoshis
   * @param {string} recipientPubkey - Recipient's public key
   * @returns {Promise<Object>} Send result with encoded token
   */
  async sendTokens(npub, amount, recipientPubkey) {
    try {
      this._validateNpub(npub);
      this._validateAmount(amount);

      if (!recipientPubkey || typeof recipientPubkey !== "string") {
        throw new Error("Invalid recipient pubkey: must be a non-empty string");
      }

      console.log(
        `[NCTools Service] Sending tokens from npub: ${npub}, amount: ${amount}, to: ${recipientPubkey}`
      );

      const response = await this.client.post(`/api/wallet/${npub}/send`, {
        amount,
        recipientPubkey,
      });

      return {
        success: true,
        encodedToken: response.data.encodedToken,
        amount,
        recipient: recipientPubkey,
        message: "Tokens sent successfully",
      };
    } catch (error) {
      return this._handleError(error, "sendTokens");
    }
  }

  /**
   * Receives tokens from an encoded token string
   * @param {string} npub - Receiver's npub
   * @param {string} encodedToken - Encoded token string to receive
   * @param {string} privateKey - Receiver's private key for decryption
   * @returns {Promise<Object>} Receive result
   */
  async receiveTokens(npub, encodedToken, privateKey) {
    try {
      this._validateNpub(npub);

      if (!encodedToken || typeof encodedToken !== "string") {
        throw new Error("Invalid encoded token: must be a non-empty string");
      }

      if (!privateKey || typeof privateKey !== "string") {
        throw new Error("Invalid private key: must be a non-empty string");
      }

      console.log(`[NCTools Service] Receiving tokens for npub: ${npub}`);

      const response = await this.client.post(`/api/wallet/${npub}/receive`, {
        encodedToken,
        privateKey,
      });

      return {
        success: true,
        received: response.data,
        message: "Tokens received successfully",
      };
    } catch (error) {
      return this._handleError(error, "receiveTokens");
    }
  }

  /**
   * Gets wallet information and status
   * @param {string} npub - User's npub
   * @returns {Promise<Object>} Wallet information
   */
  async getWalletInfo(npub) {
    try {
      this._validateNpub(npub);

      console.log(`[NCTools Service] Getting wallet info for npub: ${npub}`);

      // First ensure wallet exists
      const walletResult = await this.ensureWalletExists(npub);
      if (!walletResult.success) {
        return walletResult;
      }

      // Then get balance
      const balanceResult = await this.getBalance(npub);
      if (!balanceResult.success) {
        return balanceResult;
      }

      return {
        success: true,
        wallet: {
          npub,
          balance: balanceResult.balance,
          unit: balanceResult.unit,
          mint: this.defaultMint,
        },
        message: "Wallet info retrieved successfully",
      };
    } catch (error) {
      return this._handleError(error, "getWalletInfo");
    }
  }

  /**
   * Health check for NC Tools API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      console.log("[NCTools Service] Performing health check");

      const response = await this.client.get("/health");

      return {
        success: true,
        status: response.data,
        message: "NC Tools API is healthy",
      };
    } catch (error) {
      return this._handleError(error, "healthCheck");
    }
  }
}

// Export singleton instance
export default new NCToolsService();
