import mongoose from "mongoose";

const BroadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "document"],
      default: "text",
    },

    mediaUrl: {
      type: String,
      default: null,
    },

    targetCount: {
      type: Number,
      default: 0,
    },

    sentCount: {
      type: Number,
      default: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "running", "completed", "paused"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Broadcast", BroadcastSchema);
