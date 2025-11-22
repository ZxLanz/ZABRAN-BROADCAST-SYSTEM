import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      default: "General", // contoh: Promo, Reminder, Greeting
    },

    message: {
      type: String,
      required: true, // isi template pesan
    },

    variables: {
      type: [String],
      default: [], // contoh: ["nama", "division", "email"]
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Template", TemplateSchema);
