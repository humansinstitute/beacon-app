import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import config from "../app/config/index.js";

let mongod; // To store the MongoMemoryServer instance
let activeConnection = null; // Cache for active connection

const connectDB = async () => {
  // Return existing connection if available
  if (activeConnection) {
    return activeConnection;
  }

  // Check if Mongoose is already connected
  if (mongoose.connection.readyState === 1) {
    // 1 = connected
    activeConnection = mongoose.connection;
    if (config.app.nodeEnv !== "test") {
      console.log(`MongoDB already connected: ${mongoose.connection.host}`);
    }
    return activeConnection;
  }

  try {
    let mongoUri;
    if (config.app.nodeEnv === "test") {
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log("MongoDB In-Memory Server started for testing...");
    } else {
      mongoUri = config.database.mongoUri;
    }

    const conn = await mongoose.connect(mongoUri);

    if (config.app.nodeEnv !== "test") {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      console.log(`Database name: ${conn.connection.name}`);
      console.log(
        `Connection URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`
      );
    }

    activeConnection = conn.connection;
    return activeConnection;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error; // Throw instead of exiting to allow error handling
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
      console.log("MongoDB In-Memory Server stopped.");
    }
    if (config.app.nodeEnv !== "test") {
      console.log("MongoDB disconnected.");
    }
  } catch (error) {
    console.error(`Error disconnecting MongoDB: ${error.message}`);
    // process.exit(1); // Don't exit on disconnect error during tests
  }
};

const getMongooseInstance = () => {
  return mongoose;
};

export { connectDB, disconnectDB, getMongooseInstance };
