import { getWhatsAppClient } from "../config/whatsapp.js";
import Message from "../models/Message.js";

export const kirimPesanWA = async (nomor, pesan, broadcastId = null) => {
  try {
    const sock = getWhatsAppClient();

    // Format nomor
    const waNumber = nomor.replace(/\D/g, "") + "@s.whatsapp.net";

    // Kirim pesan
    await sock.sendMessage(waNumber, { text: pesan });

    // Simpan ke DB
    await Message.create({
      to: nomor,
      broadcastId,
      status: "sent",
      type: "text",
    });

    return { success: true };

  } catch (err) {
    await Message.create({
      to: nomor,
      broadcastId,
      status: "failed",
      type: "text",
      error: err.message,
    });

    return { success: false, error: err.message };
  }
};
