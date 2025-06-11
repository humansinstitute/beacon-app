import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

// References sub-schema
const RefsSchema = new Schema(
  {
    beaconMessageId: {
      type: Types.ObjectId,
      ref: "BeaconMessage",
      default: null,
    },
    conversationId: {
      type: Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    flowId: {
      type: Types.ObjectId,
      ref: "Flow",
      default: null,
    },
  },
  { _id: false }
);

// Adjustment sub-schema
const AdjustmentDetailsSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["charge", "deposit"],
      required: true,
    },
    prevBalance: {
      type: Number,
      required: true,
    },
    adjustment: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

// Activity sub-schema
const ActivitySchema = new Schema(
  {
    type: {
      type: String,
      default: "agentCall",
    },
    description: {
      type: String,
      default: "",
    },
    refs: RefsSchema,
    adjustment: AdjustmentDetailsSchema,
  },
  { _id: false }
);

// Main Adjustment schema
const AdjustmentSchema = new Schema(
  {
    userID: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userNpub: {
      type: String,
      required: true,
      index: true,
    },
    activity: ActivitySchema,
  },
  {
    timestamps: true,
  }
);

const Adjustment = model("Adjustment", AdjustmentSchema);
export default Adjustment;
