// backend/services/whatsappService.js
const { getWhatsAppClient, getStatus } = require("../config/whatsapp");
const Message = require("../models/Message"); // Asumsi model ini sudah CJS

const kirimPesanWA = async (nomor, pesan, broadcastId = null) => {
  try {
    const sock = getWhatsAppClient();
    if (!sock || getStatus() !== 'connected') {
        throw new Error('WhatsApp client is not connected.');
    }

    // Format nomor (pastikan tanpa +, misal 62812...)
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
    // Simpan log error ke DB
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

module.exports = { kirimPesanWA };