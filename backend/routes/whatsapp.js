import express from "express";
import { getWhatsAppClient } from "../config/whatsapp.js";

const router = express.Router();

// CHECK STATUS WA
router.get("/status", (req, res) => {
  const sock = getWhatsAppClient();
  res.json({
    connected: !!sock,
    message: sock ? "Connected" : "Disconnected",
  });
});

// SEND TEST MESSAGE
router.post("/send-test", async (req, res) => {
  try {
    const { nomor, pesan } = req.body;

    const sock = getWhatsAppClient();

    await sock.sendMessage(nomor + "@s.whatsapp.net", { text: pesan });

    res.json({ success: true, message: "Pesan terkirim!" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
