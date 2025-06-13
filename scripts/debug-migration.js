#!/usr/bin/env node

/**
 * Debug script to find and update "agent" roles in the database
 */

import mongoose from "mongoose";

async function connectDB() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/beacon";
    console.log(`🔌 Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Show database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📊 Connected to database: ${dbName}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

async function debugConversations() {
  console.log("\n🔍 Debugging Conversations collection...");

  // Get the raw collection to bypass schema validation
  const db = mongoose.connection.db;
  const conversationsCollection = db.collection("conversations");

  // Count total documents
  const totalCount = await conversationsCollection.countDocuments();
  console.log(`📊 Total conversations: ${totalCount}`);

  // Find documents with "agent" in summaryHistory
  const agentDocs = await conversationsCollection
    .find({
      "summaryHistory.role": "agent",
    })
    .toArray();

  console.log(`📊 Found ${agentDocs.length} conversations with 'agent' roles`);

  if (agentDocs.length > 0) {
    console.log("\n📋 Sample documents with 'agent' roles:");
    agentDocs.slice(0, 2).forEach((doc, index) => {
      console.log(`\nDocument ${index + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(
        `  summaryHistory length: ${doc.summaryHistory?.length || 0}`
      );
      doc.summaryHistory?.forEach((item, i) => {
        console.log(
          `    [${i}] role: "${item.role}", content: "${item.content?.substring(
            0,
            50
          )}..."`
        );
      });
    });

    // Now update them
    console.log("\n🔄 Updating documents...");
    const updateResult = await conversationsCollection.updateMany(
      { "summaryHistory.role": "agent" },
      { $set: { "summaryHistory.$[elem].role": "assistant" } },
      { arrayFilters: [{ "elem.role": "agent" }] }
    );

    console.log(
      `✅ Update result: ${updateResult.modifiedCount} documents modified`
    );

    // Verify the update
    const remainingAgentDocs = await conversationsCollection.countDocuments({
      "summaryHistory.role": "agent",
    });

    const assistantDocs = await conversationsCollection.countDocuments({
      "summaryHistory.role": "assistant",
    });

    console.log(`📊 After update:`);
    console.log(`   - Documents with 'agent' role: ${remainingAgentDocs}`);
    console.log(`   - Documents with 'assistant' role: ${assistantDocs}`);
  }
}

async function debugBeaconMessages() {
  console.log("\n🔍 Debugging BeaconMessages collection...");

  const db = mongoose.connection.db;
  const beaconCollection = db.collection("beaconmessages");

  const totalCount = await beaconCollection.countDocuments();
  console.log(`📊 Total beacon messages: ${totalCount}`);

  // Find documents with "agent" roles
  const agentMessageDocs = await beaconCollection
    .find({
      $or: [{ "message.role": "agent" }, { "response.role": "agent" }],
    })
    .toArray();

  console.log(
    `📊 Found ${agentMessageDocs.length} beacon messages with 'agent' roles`
  );

  if (agentMessageDocs.length > 0) {
    // Update message roles
    const messageResult = await beaconCollection.updateMany(
      { "message.role": "agent" },
      { $set: { "message.role": "assistant" } }
    );

    // Update response roles
    const responseResult = await beaconCollection.updateMany(
      { "response.role": "agent" },
      { $set: { "response.role": "assistant" } }
    );

    console.log(`✅ Updated ${messageResult.modifiedCount} message roles`);
    console.log(`✅ Updated ${responseResult.modifiedCount} response roles`);
  }
}

async function main() {
  console.log("🚀 Starting debug migration");

  await connectDB();

  try {
    await debugConversations();
    await debugBeaconMessages();

    console.log("\n✅ Debug migration completed!");
  } catch (error) {
    console.error("❌ Debug migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

main().catch(console.error);
