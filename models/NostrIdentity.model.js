import mongoose from "mongoose";

const NostrIdentitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required for Nostr Identity"],
      trim: true,
    },
    privkey: {
      type: String,
      required: [true, "Private key is required"],
      unique: true,
    },
    pubkey: {
      type: String,
      required: [true, "Public key is required"],
      unique: true,
      index: true,
    },
    nsec: {
      type: String,
      required: [true, "NSEC key is required"],
      unique: true,
    },
    npub: {
      type: String,
      required: [true, "NPUB key is required"],
      unique: true,
      index: true,
    },
    wa_gate_id: {
      type: String,
      required: [true, "WhatsApp Gate ID is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const NostrIdentity = mongoose.model("NostrIdentity", NostrIdentitySchema);
export default NostrIdentity;
