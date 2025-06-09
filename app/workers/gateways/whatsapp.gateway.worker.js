/**
 * app/workers/gateways/whatsapp.gateway.worker.js
 *
 * Worker process to create a whatsapp client.
 * Conntect to an account, receive messages and process
 * Process is to post a beaconMessage to the bm_in queue for processing
 *
 */

// External dependencies
// Library for interacting with WhatsApp Web and managing sessions.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
// Displays QR code in the terminal for user authentication.
import qrcode from "qrcode-terminal";
// HTTP client for API requests (used within callOSAPI).
import axios from "axios";
// Generates UUIDs for unique run identifiers.
import { v4 as uuidv4 } from "uuid";
// ODM for MongoDB database interactions.
import mongoose from "mongoose";

import {
  saveMessage,
  lastMessages,
  getHistoryByThreadId,
} from "../../services/store/conversationStore.js";

// Initialize WhatsApp client with LocalAuth persistence.
// Puppeteer args ensure compatibility in sandboxed environments.
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// Display QR code in terminal when WhatsApp Web requests authentication.
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

// Once the client is ready, log confirmation and check current budget.
client.once("ready", () => {
  console.log("Client is ready!");
  // checkAndLogBudget();
});

// Handle authentication failures by logging the error.
client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
});

// UNCLEAR IF NEEDED IN BEACON START
// MongoDB connection setup.
// Connects to the database using the URI from the environment variable.
// Uses new URL parser and unified topology for compatibility.
mongoose
  .connect(process.env.PRODMONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define the billing schema and model to track application budget.
const billingSchema = new mongoose.Schema({
  app: { type: String, required: true },
  budget: { type: Number, required: true },
});
const Budgets = mongoose.model("Budgets", billingSchema);

// Define the logging schema and model to store interaction logs.
const loggingSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  input: Object,
  output: Object,
});
const Logging = mongoose.model("Logging", loggingSchema);

/**
 * Fetches and logs the current budget for the 'avalon' application.
 *
 * @returns {Promise<void>}
 */
async function checkAndLogBudget() {
  try {
    const budgetDoc = await Budgets.findOne({ app: "avalon" });
    if (budgetDoc) {
      console.log(`Current budget for Avalon: $${budgetDoc.budget.toFixed(2)}`);
    } else {
      console.log("No budget document found for Avalon");
    }
  } catch (error) {
    console.error("Error fetching budget:", error);
  }
}

/**
 * Processes an incoming WhatsApp message by calling the OSAPI service.
 * Logs the request and response, replies to the user, and updates the budget.
 *
 * @param {import('whatsapp-web.js').Message} message - The incoming WhatsApp message object.
 * @param {string} npub - The user's npub identifier from gate details.
 * @returns {Promise<boolean>} - True on success, false on error.
 */
async function researchAnswer(message, npub, threadId) {
  try {
    // Extract the user's question and append conversation history if available.
    let questionForAgent = message.body;
    if (threadId) {
      const historyMessages = getHistoryByThreadId(threadId, 8);
      if (historyMessages.length > 0) {
        const formattedHistoryLines = historyMessages.map((msg) => {
          const prefix = msg.id.startsWith("false_") ? "User:" : "Agent:";
          return `${prefix} ${msg.body}`;
        });
        const formattedHistoryString = formattedHistoryLines.join("\n");
        questionForAgent = `${message.body}\n\nConversation History:\n${formattedHistoryString}`;
      }
    }
    const pipeData = { question: questionForAgent, action: "research" };
    const payload = {
      pipelineData: {
        runID: uuidv4(),
        payload: pipeData,
      },
      origin: {
        // Metadata for tracing and billing.
        originID: message._data.id._serialized,
        conversationID: message._data.id._serialized,
        channel: "whatsApp",
        userID: npub,
        billingID: npub,
      },
    };

    // Call the external OSAPI service.
    const response = await callOSAPI("execute", payload);

    // Store the request and response in the logging collection.
    await Logging.create({
      input: message,
      output: response,
    });

    // Reply to the user with the service response.
    const sentMessage = await message.reply(response.message);
    // Save bot's outgoing message to conversation store
    try {
      const savedBotMsg = await saveMessage(sentMessage, npub);
      console.log(
        "Bot message saved to store. ID:",
        savedBotMsg.id,
        "Thread ID:",
        savedBotMsg.threadId
      );
    } catch (botSaveError) {
      console.error(
        "Error saving bot message to conversation store:",
        botSaveError
      );
    }
    //console.log(sentMessage);

    // Deduct 5 cents from the budget for this interaction.
    await Budgets.findOneAndUpdate(
      { app: "avalon" },
      { $inc: { budget: -0.05 } },
      { new: true, upsert: true }
    );

    return true;
  } catch (error) {
    console.error("Error in researchAnswer:", error);
    // Inform the user of the error.
    const errorSent = await client.sendMessage(
      message.from,
      "Sorry, there was an error processing your request."
    );
    // Save bot's outgoing error message to conversation store
    try {
      const savedErrMsg = await saveMessage(errorSent, npub);
      console.log(
        "Bot error message saved to store. ID:",
        savedErrMsg.id,
        "Thread ID:",
        savedErrMsg.threadId
      );
    } catch (botSaveError) {
      console.error(
        "Error saving bot error message to conversation store:",
        botSaveError
      );
    }
    return false;
  }
}

/**
 * Listener for incoming WhatsApp messages.
 * - Ignores messages sent by this client.
 * - Checks budget and processes messages if sufficient funds remain.
 */
client.on("message_create", async (message) => {
  // Ignore messages sent by the bot itself.
  if (message.fromMe) {
    console.log("Ignoring message from self:", message.body);
    return;
  }

  // Lookup gate details for this user
  const gateId = message.from;
  let npub = null; // Default to null if not found
  try {
    const gateRes = await axios.get(`http://localhost:3000/id/gate/${gateId}`);
    console.log("User Details:", gateRes.data);
    npub = gateRes.data.npub;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(
        `No identity found for ${gateId}, proceeding with default behavior`
      );
      const identitySent = await client.sendMessage(
        message.from,
        "Hi I'm curently running an Avalon AI and I don't recognise your user ID!"
      );
      // Save bot identity message to store
      try {
        const savedIdentityMsg = await saveMessage(identitySent, npub);
        console.log(
          "Bot identity message saved to store. ID:",
          savedIdentityMsg.id,
          "Thread ID:",
          savedIdentityMsg.threadId
        );
      } catch (botSaveError) {
        console.error(
          "Error saving bot identity message to conversation store:",
          botSaveError
        );
      }
      return;
    } else {
      console.error("Error fetching gate details:", err);
      return;
    }
  }

  // Save the incoming message to the conversation store with npub for thread analysis
  let storedMessage;
  try {
    storedMessage = await saveMessage(message, npub);
    console.log(
      "Message saved to store. ID:",
      storedMessage.id,
      "Thread ID:",
      storedMessage.threadId
    );
  } catch (error) {
    console.error("Error saving message to conversation store:", error);
    // Just log the error and continue processing
  }

  console.log("Received message:", message.body);
  //console.log(message);

  // Retrieve and log the last 10 messages for this chat
  // const chatId = message.id.remote;
  // const last10 = lastMessages(chatId, 10);
  // console.log('Last 10 messages for chat', chatId, ':', last10);

  const callGateKeeper = await gateKeeper(message.body, "", npub);

  // Set agent call origin details
  callGateKeeper.origin.conversationID = message.id;

  // Call Groq for intent classification.
  const intentObject = await aiWrapper(callGateKeeper);

  console.log("\n\n***** THE INTENT OBJECT *****\n\n");
  console.log(intentObject);

  try {
    // Retrieve current budget for Avalon.
    const billingDoc = await Budgets.findOne({ app: "avalon" });
    // If budget is insufficient, notify the user.
    if (!billingDoc || billingDoc.budget < 0.1) {
      const budgetSent = await message.reply(
        "This app is out of budget, please contact Pete!"
      );
      // Save budget insufficient message to store
      try {
        const savedBudgetMsg = await saveMessage(budgetSent, npub);
        console.log(
          "Bot budget insufficient message saved to store. ID:",
          savedBudgetMsg.id,
          "Thread ID:",
          savedBudgetMsg.threadId
        );
      } catch (botSaveError) {
        console.error(
          "Error saving bot budget message to conversation store:",
          botSaveError
        );
      }
    } else {
      // TODO HERE: TAKE SPECIFIC ACTIONS BASED OFF INTENT

      switch (intentObject.message.intent) {
        case "research":
        case "event":
          // Process the message through researchAnswer with npub.
          // If npub is null, fall back to message.from
          await researchAnswer(
            message,
            npub || message.from,
            storedMessage.threadId
          );
          // Additional budget decrement for researchAnswer.
          billingDoc.budget -= 0.05;
          await billingDoc.save();
          break;
        case "conversation":
          const convSent = await message.reply(
            intentObject.message.quickResponse
          );
          // Save conversation quickResponse message to store
          try {
            const savedConvMsg = await saveMessage(convSent, npub);
            console.log(
              "Bot conversation response saved to store. ID:",
              savedConvMsg.id,
              "Thread ID:",
              savedConvMsg.threadId
            );
          } catch (botSaveError) {
            console.error(
              "Error saving bot conversation response to conversation store:",
              botSaveError
            );
          }
          // No additional budget decrement or save needed here for this specific action path
          break;
        //
        // THIS NEEDS TO BE REMOVED ITS NOT AN INTENT
        // case 'history':
        //     try {
        //         const chatId = message.id.remote; // This is the WhatsApp conversation ID
        //         const recentMessages = lastMessages(chatId, 10); // Get last 10 messages

        //         if (recentMessages.length > 0) {
        //             let replyText = "Here are the last messages in this chat:\n";
        //             recentMessages.forEach((msg, index) => {
        //                 const date = new Date(msg.timestamp * 1000).toLocaleString();
        //                 // Determine sender label based on message direction
        //                 const sender = msg.from === message.to ? 'Bot' : (msg.from === message.from ? 'You' : msg.from);
        //                 replyText += `${index + 1}. [${date}] From: ${sender}: ${msg.body.substring(0, 50)}${msg.body.length > 50 ? '...' : ''}\n`;
        //             });
        //             await message.reply(replyText);
        //         } else {
        //             await message.reply("No message history found for this chat yet.");
        //         }
        //     } catch (error) {
        //         console.error('Error retrieving or sending message history:', error);
        //         await message.reply("Sorry, I couldn't retrieve the message history at this time.");
        //     }
        //     break;
        case "post":
          try {
            // Extract the message to post to nostr
            const callExtractPost = await extractPost(message.body, "", npub);
            // Set agent call origin details
            callExtractPost.origin.conversationID = message.id;
            // Call Groq for intent classification.
            const NostrPost = await aiWrapper(callExtractPost);
            const thePost = NostrPost.message.post;
            console.log("\n**** THE POST OBJECT ****\n\n");
            console.log(NostrPost);

            // Validate post content
            if (
              !thePost ||
              typeof thePost !== "string" ||
              thePost.trim() === ""
            ) {
              console.log("No valid post content extracted or post is empty.");
              await client.sendMessage(
                message.from,
                "I couldn't figure out what you want to post, or the message was empty."
              );
              break;
            }

            // Submit post to Nostr with direct post.
            // const nostrPostUrl = 'http://localhost:3000/post/note';
            // const postData = {
            //     npub: npub,
            //     content: thePost,
            //     powBits: 20,
            //     timeoutMs: 10000
            // };

            // Submit post to Nostr with remote signing via Nostr MQ.
            const nostrPostUrl = "http://localhost:3000/post/note_remote";
            const postData = {
              senderNpub: npub,
              callNpub:
                "npub17nqywpr8hvssklds0hd7uml8ydkw5vy2fj4dt6x93snh5tt9wl0sy56jrh",
              responseNpub: npub,
              signerNpub: npub,
              noteContent: thePost,
              powBits: 20,
              timeoutMs: 10000,
            };

            console.log(
              `Attempting to post to Nostr for npub ${npub}:`,
              JSON.stringify(postData)
            );
            const nostrApiResponse = await axios.post(nostrPostUrl, postData, {
              headers: {
                "Content-Type": "application/json",
              },
            });

            console.log(
              "Successfully posted to Nostr. API Response:",
              nostrApiResponse.data
            );
            const postSent = await message.reply(`Posted to nostr ${thePost}`);
            // Save post success message to store
            try {
              const savedPostMsg = await saveMessage(postSent, npub);
              console.log(
                "Bot post success message saved to store. ID:",
                savedPostMsg.id,
                "Thread ID:",
                savedPostMsg.threadId
              );
            } catch (botSaveError) {
              console.error(
                "Error saving bot post success message to conversation store:",
                botSaveError
              );
            }
          } catch (err) {
            console.error(
              'Error in "post" intent processing:',
              err.response ? err.response.data : err.message
            );
            const postErrSent = await client.sendMessage(
              message.from,
              `Sorry, I wasn't able to send your note to Nostr. Please try again later.`
            );
            // Save bot post error message to store
            try {
              const savedPostErrMsg = await saveMessage(postErrSent, npub);
              console.log(
                "Bot post error message saved to store. ID:",
                savedPostErrMsg.id,
                "Thread ID:",
                savedPostErrMsg.threadId
              );
            } catch (botSaveError) {
              console.error(
                "Error saving bot post error message to conversation store:",
                botSaveError
              );
            }
          }
          break;

        default:
          // Fallback for unhandled intents: respond with quickResponse
          console.log(
            `Unhandled intent: ${intentObject.message.intent}. Responding with quickResponse.`
          );
          if (intentObject.message.quickResponse) {
            const defaultSent = await message.reply(
              intentObject.message.quickResponse
            );
            // Save default quickResponse message to store
            try {
              const savedDefaultMsg = await saveMessage(defaultSent, npub);
              console.log(
                "Bot default quickResponse message saved to store. ID:",
                savedDefaultMsg.id,
                "Thread ID:",
                savedDefaultMsg.threadId
              );
            } catch (botSaveError) {
              console.error(
                "Error saving bot default quickResponse message to conversation store:",
                botSaveError
              );
            }
          } else {
            // Fallback if quickResponse is also missing for some reason
            const fallbackSent = await message.reply(
              "I'm not sure how to handle that request right now."
            );
            // Save default fallback message to store
            try {
              const savedFallbackMsg = await saveMessage(fallbackSent, npub);
              console.log(
                "Bot default fallback message saved to store. ID:",
                savedFallbackMsg.id,
                "Thread ID:",
                savedFallbackMsg.threadId
              );
            } catch (botSaveError) {
              console.error(
                "Error saving bot default fallback message to conversation store:",
                botSaveError
              );
            }
            console.log(
              "Warning: quickResponse was also undefined for unhandled intent."
            );
          }
          break;
      }
    }
  } catch (error) {
    console.error("Error checking budget or updating billing:", error);
    // Inform the user of any processing errors.
    const catchSent = await message.reply(
      "Sorry, there was an error processing your request."
    );
    // Save bot catch error message to store
    try {
      const savedCatchMsg = await saveMessage(catchSent, npub);
      console.log(
        "Bot catch error message saved to store. ID:",
        savedCatchMsg.id,
        "Thread ID:",
        savedCatchMsg.threadId
      );
    } catch (botSaveError) {
      console.error(
        "Error saving bot catch error message to conversation store:",
        botSaveError
      );
    }
  }
});

// Start the WhatsApp client connection process.
client.initialize();
