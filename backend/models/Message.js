import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    broadcastId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Broadcast",
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
    },

    error: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Message", MessageSchema);
