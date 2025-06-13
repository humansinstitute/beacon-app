#!/usr/bin/env node

/**
 * Migration script to update role "agent" to "assistant" in existing data
 * This ensures compatibility with OpenAI API standards
 */

import mongoose from "mongoose";
import { BeaconMessage, Conversation } from "../models/index.js";

async function connectDB() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/beacon";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

async function migrateBeaconMessages() {
  console.log("\n🔄 Migrating BeaconMessage documents...");

  // Update message.role from "agent" to "assistant"
  const messageResult = await BeaconMessage.updateMany(
    { "message.role": "agent" },
    { $set: { "message.role": "assistant" } }
  );

  // Update response.role from "agent" to "assistant"
  const responseResult = await BeaconMessage.updateMany(
    { "response.role": "agent" },
    { $set: { "response.role": "assistant" } }
  );

  console.log(
    `✅ Updated ${messageResult.modifiedCount} BeaconMessage message roles`
  );
  console.log(
    `✅ Updated ${responseResult.modifiedCount} BeaconMessage response roles`
  );
}

async function migrateConversations() {
  console.log("\n🔄 Migrating Conversation summaryHistory...");

  // First, let's see how many documents have "agent" roles
  const docsWithAgent = await Conversation.find({
    "summaryHistory.role": "agent",
  });
  console.log(
    `📊 Found ${docsWithAgent.length} conversations with 'agent' roles`
  );

  // Update using the correct MongoDB syntax for nested arrays
  const result = await Conversation.updateMany(
    { "summaryHistory.role": "agent" },
    { $set: { "summaryHistory.$[elem].role": "assistant" } },
    { arrayFilters: [{ "elem.role": "agent" }] }
  );

  console.log(`✅ Updated ${result.modifiedCount} Conversation documents`);

  // Alternative approach if the above doesn't work - update each document individually
  if (result.modifiedCount === 0 && docsWithAgent.length > 0) {
    console.log("🔄 Trying individual document updates...");
    let updatedCount = 0;

    for (const doc of docsWithAgent) {
      // Update each summaryHistory item with role "agent"
      doc.summaryHistory.forEach((item) => {
        if (item.role === "agent") {
          item.role = "assistant";
        }
      });

      await doc.save();
      updatedCount++;
    }

    console.log(
      `✅ Individually updated ${updatedCount} Conversation documents`
    );
  }
}

async function validateMigration() {
  console.log("\n🔍 Validating migration...");

  // Check for any remaining "agent" roles
  const beaconMessageCount = await BeaconMessage.countDocuments({
    $or: [{ "message.role": "agent" }, { "response.role": "agent" }],
  });

  const conversationCount = await Conversation.countDocuments({
    "summaryHistory.role": "agent",
  });

  if (beaconMessageCount === 0 && conversationCount === 0) {
    console.log("✅ Migration successful! No 'agent' roles found.");
  } else {
    console.log(`⚠️  Migration incomplete:`);
    console.log(`   - BeaconMessages with 'agent' role: ${beaconMessageCount}`);
    console.log(`   - Conversations with 'agent' role: ${conversationCount}`);
  }

  // Show counts of "assistant" roles
  const assistantBeaconCount = await BeaconMessage.countDocuments({
    $or: [{ "message.role": "assistant" }, { "response.role": "assistant" }],
  });

  const assistantConversationCount = await Conversation.countDocuments({
    "summaryHistory.role": "assistant",
  });

  console.log(`📊 Current 'assistant' role counts:`);
  console.log(`   - BeaconMessages: ${assistantBeaconCount}`);
  console.log(`   - Conversations: ${assistantConversationCount}`);
}

async function main() {
  console.log("🚀 Starting migration: agent → assistant");

  await connectDB();

  try {
    await migrateBeaconMessages();
    await migrateConversations();
    await validateMigration();

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run migration if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { main as migrateAgentToAssistant };
