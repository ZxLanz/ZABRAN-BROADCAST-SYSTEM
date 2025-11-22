import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

let sock;

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on("connection.update", ({ qr, connection }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("📱 WA Connected!");
    if (connection === "close") console.log("❌ WA Disconnected!");
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

export function getSocket() {
  return sock;
}
