import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod; // To store the MongoMemoryServer instance

const connectDB = async () => {
  try {
    let mongoUri;
    if (process.env.NODE_ENV === "test") {
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log("MongoDB In-Memory Server started for testing...");
    } else {
      mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/thebeacon";
    }

    const conn = await mongoose.connect(mongoUri);

    if (process.env.NODE_ENV !== "test") {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    return conn.connection; // Return the connection object
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
      console.log("MongoDB In-Memory Server stopped.");
    }
    if (process.env.NODE_ENV !== "test") {
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
