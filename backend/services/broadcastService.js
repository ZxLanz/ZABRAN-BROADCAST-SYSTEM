import Broadcast from "../models/Broadcast.js";
import Customer from "../models/Customer.js";
import { kirimPesanWA } from "./whatsappService.js";

export const sendBroadcastNow = async (broadcast) => {
  try {
    const { _id, message } = broadcast;

    // Ambil semua customer
    const customers = await Customer.find();

    console.log(`MEMULAI BROADCAST: ${customers.length} nomor`);

    for (let i = 0; i < customers.length; i++) {
      const cust = customers[i];

      console.log(`Mengirim ke ${cust.nomor} (${i + 1}/${customers.length})`);

      await kirimPesanWA(cust.nomor, message, _id);

      // Delay anti-ban (20–30 detik)
      const delay = 20000 + Math.floor(Math.random() * 10000);
      console.log(`Delay ${delay / 1000} detik...`);
      await new Promise((res) => setTimeout(res, delay));
    }

    await Broadcast.findByIdAndUpdate(_id, { status: "done" });

    console.log("Broadcast selesai!");

  } catch (err) {
    console.error("Broadcast error:", err.message);
  }
};
