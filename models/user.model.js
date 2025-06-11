import mongoose from "mongoose";

const RemoteSignerSchema = new mongoose.Schema(
  {
    inUse: {
      type: Boolean,
      default: false,
    },
    npub: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    npub: {
      type: String,
      required: [true, "NPUB key is required"],
      unique: true,
      index: true,
    },
    remoteSigner: {
      type: RemoteSignerSchema,
      default: () => ({}),
    },
    beaconBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema);
export default User;
