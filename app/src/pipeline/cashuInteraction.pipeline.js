import cashuIntentAgent from "../agents/cashuIntentAgent.js";
import { callEverest } from "../../api/services/everest.service.js";
import ncToolsService from "../../api/services/nctools.service.js";

/**
 * Processes the Cashu interaction pipeline by orchestrating wallet operations
 * @param {Object} jobData - The job data containing the beacon message
 * @returns {Promise<string>} The response message for the user
 */
export async function processCashuPipeline(jobData) {
  const { beaconMessage } = jobData;

  console.log("[CashuPipeline] Starting Cashu pipeline processing");

  try {
    // 1. Validate user context
    if (!beaconMessage.user?.npub) {
      console.error("[CashuPipeline] No user npub found in beacon message");
      return "❌ Unable to process Cashu request. Please ensure you're registered with the system.";
    }

    const userNpub = beaconMessage.user.npub;
    console.log(`[CashuPipeline] Processing for user: ${userNpub}`);

    // 2. Ensure wallet exists
    console.log("[CashuPipeline] Ensuring wallet exists...");
    const walletResult = await ncToolsService.ensureWalletExists(userNpub);
    if (!walletResult.success) {
      console.error(
        "[CashuPipeline] Failed to ensure wallet exists:",
        walletResult
      );
      return formatErrorResponse(walletResult, "wallet_creation");
    }

    // 3. Extract Cashu operation intent
    console.log("[CashuPipeline] Extracting operation intent...");
    const contextInfo = `The users name is: ${
      beaconMessage.user?.name || "Unknown"
    }.\n`;

    // Extract conversation history if available
    let conversationHistory = [];
    if (jobData.conversation && jobData.conversation.summaryHistory) {
      const rawHistory = jobData.conversation.summaryHistory.slice(0, -1);
      conversationHistory = rawHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }

    const agentData = await cashuIntentAgent(
      beaconMessage.message.content,
      contextInfo,
      conversationHistory
    );

    // Add origin data from beacon message
    agentData.origin = {
      ...agentData.origin,
      ...beaconMessage.origin,
    };

    // Call Everest to get the operation classification
    const response = await callEverest(agentData, {
      userID: beaconMessage.user._id,
      userNpub: userNpub,
    });

    let operation;
    try {
      // Handle both string and object responses from Everest service
      if (typeof response.message === 'string') {
        operation = JSON.parse(response.message);
        console.log("[CashuPipeline] Parsed operation from JSON string:", operation);
      } else if (typeof response.message === 'object' && response.message !== null) {
        operation = response.message;
        console.log("[CashuPipeline] Using operation object directly:", operation);
      } else {
        throw new Error(`Unexpected response.message type: ${typeof response.message}`);
      }

      // Validate operation structure
      if (!operation || typeof operation !== 'object') {
        throw new Error("Operation is not a valid object");
      }
      
      if (!operation.type) {
        throw new Error("Operation missing required 'type' field");
      }

    } catch (error) {
      console.error(
        "[CashuPipeline] Failed to parse operation response:",
        error
      );
      console.error("[CashuPipeline] Response.message type:", typeof response.message);
      console.error("[CashuPipeline] Response.message value:", response.message);
      return "❌ I'm having trouble understanding your Cashu request. Please try rephrasing it.";
    }

    // 4. Execute operation based on type
    console.log(`[CashuPipeline] Executing operation: ${operation.type}`);
    let result;

    switch (operation.type) {
      case "balance":
        result = await executeBalanceCheck(userNpub);
        break;
      case "pay_invoice":
        if (!operation.parameters?.invoice) {
          return "❌ Please provide a valid Lightning invoice to pay.";
        }
        result = await executePayInvoice(
          userNpub,
          operation.parameters.invoice
        );
        break;
      case "receive_invoice":
        if (!operation.parameters?.amount) {
          return "❌ Please specify an amount for the invoice (e.g., '1000 sats').";
        }
        result = await executeGenerateInvoice(
          userNpub,
          operation.parameters.amount
        );
        break;
      case "send_tokens":
        if (!operation.parameters?.amount) {
          return "❌ Please specify an amount to send (e.g., '1000 sats').";
        }
        if (!operation.parameters?.recipient) {
          return "❌ Please specify who you want to send tokens to.";
        }
        result = await executeSendTokens(
          userNpub,
          operation.parameters.amount,
          operation.parameters.recipient
        );
        break;
      case "unknown":
      default:
        return "I understand you want to do something with Bitcoin/Cashu, but I'm not sure what exactly. You can:\n\n• Check balance: 'check my balance'\n• Pay invoice: 'pay [invoice]'\n• Create invoice: 'create invoice for [amount] sats'\n• Send tokens: 'send [amount] sats to [recipient]'";
    }

    // 5. Format and return response
    console.log(`[CashuPipeline] Operation result:`, result);
    return result.message;
  } catch (error) {
    console.error("[CashuPipeline] Pipeline error:", error);
    return "❌ I'm sorry, Cashu services are currently experiencing issues. Please try again later.";
  }
}

/**
 * Executes balance check operation
 * @param {string} userNpub - User's npub
 * @returns {Promise<Object>} Operation result
 */
async function executeBalanceCheck(userNpub) {
  console.log(`[CashuPipeline] Checking balance for: ${userNpub}`);

  const balanceResult = await ncToolsService.getBalance(userNpub);

  if (!balanceResult.success) {
    console.error("[CashuPipeline] Balance check failed:", balanceResult);
    return {
      success: false,
      message: formatErrorResponse(balanceResult, "balance_check"),
    };
  }

  return {
    success: true,
    message: formatBalanceResponse(balanceResult.balance),
  };
}

/**
 * Executes Lightning invoice payment
 * @param {string} userNpub - User's npub
 * @param {string} invoice - Lightning invoice to pay
 * @returns {Promise<Object>} Operation result
 */
async function executePayInvoice(userNpub, invoice) {
  console.log(`[CashuPipeline] Paying invoice for: ${userNpub}`);

  // Validate invoice format
  if (!invoice.startsWith("lnbc")) {
    return {
      success: false,
      message:
        "❌ That doesn't look like a valid Lightning invoice. Lightning invoices start with 'lnbc'.",
    };
  }

  const paymentResult = await ncToolsService.payInvoice(userNpub, invoice);

  if (!paymentResult.success) {
    console.error("[CashuPipeline] Payment failed:", paymentResult);
    return {
      success: false,
      message: formatErrorResponse(paymentResult, "pay_invoice"),
    };
  }

  return {
    success: true,
    message: formatPaymentResponse(paymentResult),
  };
}

/**
 * Executes Lightning invoice generation
 * @param {string} userNpub - User's npub
 * @param {number} amount - Amount in satoshis
 * @returns {Promise<Object>} Operation result
 */
async function executeGenerateInvoice(userNpub, amount) {
  console.log(
    `[CashuPipeline] Generating invoice for: ${userNpub}, amount: ${amount}`
  );

  // Validate amount
  if (!amount || amount <= 0) {
    return {
      success: false,
      message: "❌ Please specify a valid amount greater than 0 sats.",
    };
  }

  const invoiceResult = await ncToolsService.generateInvoice(userNpub, amount);

  if (!invoiceResult.success) {
    console.error("[CashuPipeline] Invoice generation failed:", invoiceResult);
    return {
      success: false,
      message: formatErrorResponse(invoiceResult, "generate_invoice"),
    };
  }

  return {
    success: true,
    message: formatInvoiceResponse(invoiceResult.invoice, amount),
  };
}

/**
 * Executes token sending operation
 * @param {string} userNpub - Sender's npub
 * @param {number} amount - Amount to send
 * @param {string} recipient - Recipient identifier
 * @returns {Promise<Object>} Operation result
 */
async function executeSendTokens(userNpub, amount, recipient) {
  console.log(
    `[CashuPipeline] Sending tokens from: ${userNpub}, amount: ${amount}, to: ${recipient}`
  );

  // Validate amount
  if (!amount || amount <= 0) {
    return {
      success: false,
      message: "❌ Please specify a valid amount greater than 0 sats.",
    };
  }

  // Check balance first
  const balanceResult = await ncToolsService.getBalance(userNpub);
  if (!balanceResult.success) {
    return {
      success: false,
      message: "❌ Unable to check your balance. Please try again later.",
    };
  }

  if (balanceResult.balance < amount) {
    return {
      success: false,
      message: `❌ Insufficient balance. You have ${balanceResult.balance} sats, but need ${amount} sats.`,
    };
  }

  // For now, we'll treat recipient as a pubkey
  // In a real implementation, you might want to resolve usernames to pubkeys
  const sendResult = await ncToolsService.sendTokens(
    userNpub,
    amount,
    recipient
  );

  if (!sendResult.success) {
    console.error("[CashuPipeline] Send tokens failed:", sendResult);
    return {
      success: false,
      message: formatErrorResponse(sendResult, "send_tokens"),
    };
  }

  return {
    success: true,
    message: `✅ Sent ${amount} sats successfully to ${recipient}`,
  };
}

/**
 * Formats balance response for user display
 * @param {number} balance - Wallet balance in sats
 * @returns {string} Formatted balance message
 */
function formatBalanceResponse(balance) {
  return `💰 Your wallet balance is ${balance} sats`;
}

/**
 * Formats payment response for user display
 * @param {Object} paymentResult - Payment result from NC Tools
 * @returns {string} Formatted payment message
 */
function formatPaymentResponse(paymentResult) {
  const payment = paymentResult.payment;
  const amount = payment.amount || "unknown";
  const fee = payment.fee || 0;

  return `✅ Payment sent! Paid ${amount} sats. Fee: ${fee} sats`;
}

/**
 * Formats invoice response for user display
 * @param {string} invoice - Generated Lightning invoice
 * @param {number} amount - Invoice amount
 * @returns {string} Formatted invoice message
 */
function formatInvoiceResponse(invoice, amount) {
  return `📄 Here's your invoice for ${amount} sats:\n\n${invoice}\n\nShare this with someone to receive payment.`;
}

/**
 * Formats error responses based on error type and operation
 * @param {Object} error - Error object from NC Tools
 * @param {string} operation - Operation that failed
 * @returns {string} User-friendly error message
 */
function formatErrorResponse(error, operation) {
  console.log(
    `[CashuPipeline] Formatting error for operation: ${operation}`,
    error
  );

  // Handle specific error types
  if (error.type === "CONNECTION_ERROR") {
    return "❌ I'm sorry, Cashu services are currently down. Please try again later.";
  }

  if (error.type === "TIMEOUT_ERROR") {
    return "❌ The request timed out. Please try again.";
  }

  // Handle operation-specific errors
  switch (operation) {
    case "wallet_creation":
      return "❌ Unable to create your Cashu wallet. Please try again later.";

    case "balance_check":
      return "❌ Unable to check your balance right now. Please try again later.";

    case "pay_invoice":
      if (error.status === 400) {
        return "❌ That doesn't look like a valid Lightning invoice.";
      }
      if (error.status === 402) {
        return "❌ Insufficient balance to pay this invoice.";
      }
      return "❌ Payment failed. Please check the invoice and try again.";

    case "generate_invoice":
      return "❌ Unable to generate invoice right now. Please try again later.";

    case "send_tokens":
      if (error.status === 400) {
        return "❌ Invalid recipient or amount. Please check and try again.";
      }
      if (error.status === 402) {
        return "❌ Insufficient balance for this transaction.";
      }
      return "❌ Unable to send tokens right now. Please try again later.";

    default:
      return "❌ Something went wrong. Please try again later.";
  }
}
