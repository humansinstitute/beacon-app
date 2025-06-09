import mongoose from "mongoose";
import dotenv from "dotenv";
import NostrIdentity from "../models/NostrIdentity.model.js"; // Adjusted path

// Load environment variables from .env file
dotenv.config();

describe("MongoDB Connection and NostrIdentity CRUD", () => {
  // Connection URI from environment variables
  const mongoURI = process.env.MONGO_URI;

  beforeAll(async () => {
    if (!mongoURI) {
      throw new Error(
        "MONGO_URI not found in environment variables. Please ensure it is set in your .env file."
      );
    }
    try {
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("MongoDB connected for testing...");
    } catch (err) {
      console.error("MongoDB connection error:", err.message);
      // Throw an error to stop tests if connection fails
      throw err;
    }
  });

  afterAll(async () => {
    try {
      // It's good practice to clean up any collections or specific documents if needed,
      // but for this test, we are just disconnecting.
      // If you have a dedicated test database, you might drop it here.
      // await mongoose.connection.db.dropDatabase(); // Example: if using a dedicated test DB
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
    } catch (err) {
      console.error("MongoDB disconnection error:", err.message);
      throw err;
    }
  });

  test("should connect to MongoDB, create and delete a NostrIdentity record", async () => {
    const testData = {
      name: "Test User",
      privkey: `test_privkey_${Date.now()}`, // Unique private key
      pubkey: `test_pubkey_${Date.now()}`, // Unique public key
      nsec: `test_nsec_${Date.now()}`, // Unique nsec
      npub: `test_npub_${Date.now()}`, // Unique npub
      wa_gate_id: `test_wa_gate_id_${Date.now()}`, // Unique wa_gate_id
    };

    let createdRecord;

    try {
      // Create a record
      createdRecord = new NostrIdentity(testData);
      await createdRecord.save();
      expect(createdRecord._id).toBeDefined();
      expect(createdRecord.name).toBe(testData.name);
      console.log("Record created:", createdRecord._id);

      // Verify the record exists in the database
      const foundRecord = await NostrIdentity.findById(createdRecord._id);
      expect(foundRecord).not.toBeNull();
      expect(foundRecord.name).toBe(testData.name);

      // Delete the record
      const deleteResult = await NostrIdentity.findByIdAndDelete(
        createdRecord._id
      );
      expect(deleteResult).not.toBeNull();
      expect(deleteResult._id.toString()).toBe(createdRecord._id.toString());
      console.log("Record deleted:", createdRecord._id);

      // Verify the record is deleted
      const deletedRecordCheck = await NostrIdentity.findById(
        createdRecord._id
      );
      expect(deletedRecordCheck).toBeNull();
    } catch (error) {
      console.error("Test failed:", error.message);
      // If a record was created but deletion failed, try to clean it up
      if (createdRecord && createdRecord._id) {
        try {
          await NostrIdentity.findByIdAndDelete(createdRecord._id);
          console.log(
            "Cleaned up record after test failure:",
            createdRecord._id
          );
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup record after test failure:",
            cleanupError.message
          );
        }
      }
      throw error; // Re-throw error to fail the test
    }
  });
});
