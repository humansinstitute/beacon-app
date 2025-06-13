// models/index.js -----------------------------------------------------------
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

/* ---------- Shared sub-schemas ---------- */
const MsgMetaSchema = new Schema(
  {
    content: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    messageID: { type: String, required: true }, // native msg-id in gateway
    replyTo: { type: String, default: null },
    ts: { type: Number, required: true }, // unix-epoch seconds
  },
  { _id: false }
);

const OriginSchema = new Schema(
  {
    channel: { type: String, required: true }, // e.g. waGateway
    gatewayUserID: { type: String, required: true },
    gatewayMessageID: { type: String, required: true },
    gatewayReplyTo: { type: String, default: null },
    gatewayNpub: { type: String, required: true },
    userNpub: { type: String, required: true },
  },
  { _id: false }
);

/* ---------- BeaconMessage ---------- */
const BeaconMsgSchema = new Schema(
  {
    message: MsgMetaSchema,
    response: { type: MsgMetaSchema, required: false }, // populated after reply
    origin: OriginSchema,

    /* cross-refs (ObjectId keeps joins cheap) */
    conversationRef: { type: Types.ObjectId, ref: "Conversation", index: true },
    flowRef: { type: Types.ObjectId, ref: "Flow", index: true },
  },
  { timestamps: true } // createdAt / updatedAt
);

export const BeaconMessage = model("BeaconMessage", BeaconMsgSchema);

/* ---------- Conversation ---------- */
const ConversationSchema = new Schema(
  {
    summaryHistory: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
      },
    ],

    /* list of BeaconMessage _ids (append-only, ordered) */
    history: [{ type: Types.ObjectId, ref: "BeaconMessage" }],

    activeFlow: { type: Types.ObjectId, ref: "Flow", default: null },
  },
  { timestamps: true }
);

export const Conversation = model("Conversation", ConversationSchema);

/* ---------- Flow ---------- */
const WorkflowStepSchema = new Schema(
  {
    order: { type: Number, required: true },
    action: { type: Schema.Types.Mixed, required: true }, // keeps it future-proof
    output: { type: Schema.Types.Mixed, default: null },
    exit: { field: String, eval: String, value: Schema.Types.Mixed },
    state: { type: String, enum: ["open", "closed"], default: "open" },
  },
  { _id: false }
);

const FlowSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["research", "websearch", "conversation"],
      required: true,
    },
    workflow: [WorkflowStepSchema],
    state: { type: String }, // free-form description
    data: [{ type: Schema.Types.Mixed }], // flexible key/vals

    conversationRef: { type: Types.ObjectId, ref: "Conversation", index: true },
  },
  { timestamps: true }
);

export const Flow = model("Flow", FlowSchema);
