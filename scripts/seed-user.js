import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../libs/db.js";
import User from "../models/user.model.js";

/**
 * Seed or update a user with provided npub, name, remoteSigner, and aliases.
 * - Upserts by npub
 * - Adds missing aliases without duplicates
 * - Ensures useful indexes for lookup speed
 * - Verifies WhatsApp alias lookup path used by the worker
 */
async function upsertUser() {
  const userData = {
    npub: "npub1wyzpcyjdhzfnjct59rde7nusfyaus8v7wwh0hdwwjsuku0rjvshqugy62t",
    name: "pw21",
    remoteSigner: {
      inUse: false,
      npub: "npub1signer1234567890abcdef",
    },
    alias: [
      { type: "wa", ref: "61487097701@c.us" },
      { type: "sms", ref: "+61450160733" },
    ],
  };

  try {
    await connectDB();
    console.log("[seed-user] Connected to MongoDB");

    // Upsert by npub
    const filter = { npub: userData.npub };
    const update = {
      $set: {
        name: userData.name,
        "remoteSigner.inUse": userData.remoteSigner.inUse,
        "remoteSigner.npub": userData.remoteSigner.npub,
      },
      $addToSet: {
        alias: { $each: userData.alias },
      },
    };
    const options = { upsert: true, new: true };

    const result = await User.findOneAndUpdate(filter, update, options).lean();
    console.log("[seed-user] Upserted user by npub:", {
      id: result?._id,
      npub: result?.npub,
      name: result?.name,
      aliasCount: result?.alias?.length ?? 0,
    });

    // Verify WhatsApp alias lookup compatibility (used by lookupUserByAlias in worker)
    const waAlias = userData.alias.find((a) => a.type === "wa");
    if (waAlias) {
      const waMatch = await User.findOne({
        alias: { $elemMatch: { type: "wa", ref: waAlias.ref } },
      })
        .select("_id npub name alias")
        .lean();

      console.log("[seed-user] WhatsApp alias lookup verification:", {
        found: !!waMatch,
        userId: waMatch?._id,
        npub: waMatch?.npub,
        name: waMatch?.name,
      });
    }

    // Ensure indexes (safe to re-run)
    try {
      await User.collection.createIndex({ npub: 1 }, { unique: true });
    } catch (_) {
      // ignore if exists
    }
    try {
      await User.collection.createIndex({ "alias.type": 1, "alias.ref": 1 });
    } catch (_) {
      // ignore if exists
    }
    console.log("[seed-user] Ensured indexes on npub and alias");

    console.log("[seed-user] Done");
  } catch (err) {
    console.error("[seed-user] Error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  upsertUser();
}

export default upsertUser;