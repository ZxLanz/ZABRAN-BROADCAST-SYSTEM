import express from "express";
import Broadcast from "../models/Broadcast.js";
import { sendBroadcastNow } from "../services/broadcastService.js";

const router = express.Router();

// GET ALL BROADCASTS
router.get("/", async (req, res) => {
  const data = await Broadcast.find().sort({ createdAt: -1 });
  res.json({ success: true, data });
});

// CREATE BROADCAST
router.post("/", async (req, res) => {
  try {
    const bc = await Broadcast.create(req.body);

    // Jika immediate, langsung kirim
    if (bc.sendNow) {
      sendBroadcastNow(bc);
    }

    res.json({ success: true, data: bc });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
