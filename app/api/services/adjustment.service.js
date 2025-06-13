import Adjustment from "../../../models/adjustment.model.js";
import User from "../../../models/user.model.js";
import mongoose from "mongoose";

/**
 * Creates an adjustment record and updates the user's balance atomically.
 * @param {ObjectId} userID - The ID of the user.
 * @param {string} userNpub - The NPub of the user.
 * @param {Object} activityData - The activity data for the adjustment.
 * @param {number} adjustmentAmount - The amount to adjust the balance by (negative for charge, positive for deposit).
 * @returns {Promise<Object>} The created adjustment record.
 */
export async function createAdjustmentAndUpdateBalance(
  userID,
  userNpub,
  activityData,
  adjustmentAmount
) {
  console.log("[Adjustment Service] Starting adjustment creation:", {
    userID,
    userNpub,
    activityData,
    adjustmentAmount,
  });

  try {
    // Convert to ObjectId if it's a string
    const objectId =
      typeof userID === "string" ? new mongoose.Types.ObjectId(userID) : userID;

    console.log("[Adjustment Service] Finding user with ID:", userID);

    // Get current user data
    const user = await User.findById(objectId);
    if (!user) {
      throw new Error("User not found");
    }

    console.log("[Adjustment Service] User found:", {
      id: user._id,
      npub: user.npub,
      currentBalance: user.beaconBalance,
    });

    const prevBalance = user.beaconBalance;
    const newBalance = prevBalance + adjustmentAmount;

    console.log("[Adjustment Service] Balance calculation:", {
      prevBalance,
      adjustmentAmount,
      newBalance,
    });

    // Create adjustment record
    const adjustment = new Adjustment({
      userID,
      userNpub,
      activity: {
        type: "agentCall",
        description: activityData.description || "Everest API call",
        refs: activityData.refs,
        adjustment: {
          type: adjustmentAmount < 0 ? "charge" : "deposit",
          prevBalance,
          adjustment: Math.abs(adjustmentAmount),
          newBalance,
        },
      },
    });

    console.log("[Adjustment Service] Adjustment record created:", {
      userID: adjustment.userID,
      type: adjustment.activity.adjustment.type,
      amount: adjustment.activity.adjustment.adjustment,
    });

    // Save adjustment record
    console.log("[Adjustment Service] Saving adjustment record...");
    await adjustment.save();
    console.log(
      "[Adjustment Service] Adjustment saved with ID:",
      adjustment._id
    );

    // Update user balance
    user.beaconBalance = newBalance;
    console.log("[Adjustment Service] Updating user balance...");
    await user.save();
    console.log("[Adjustment Service] User balance updated successfully");

    return adjustment;
  } catch (error) {
    console.error("[Adjustment Service] Error creating adjustment:", error);
    throw new Error(`Error creating adjustment: ${error.message}`);
  }
}

/**
 * Validates that the user's balance matches the sum of all their adjustments.
 * @param {ObjectId} userID - The ID of the user to validate.
 * @returns {Promise<boolean>} Whether the balance is consistent with adjustments.
 */
export async function validateBalanceConsistency(userID) {
  try {
    const user = await User.findById(userID);
    if (!user) {
      throw new Error("User not found");
    }

    const totalAdjustments = await Adjustment.aggregate([
      { $match: { userID } },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$activity.adjustment.adjustment",
          },
        },
      },
    ]);

    const expectedBalance =
      totalAdjustments.length > 0 ? totalAdjustments[0].total : 0;

    return user.beaconBalance === expectedBalance;
  } catch (error) {
    throw new Error(`Error validating balance: ${error.message}`);
  }
}
