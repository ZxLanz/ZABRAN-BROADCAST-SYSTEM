// File: backend/config/whatsapp.js - State Management untuk WhatsApp
let whatsappClient = null;
let currentQrCode = null;
let currentStatus = 'disconnected'; // 'disconnected', 'qrcode', 'connected', 'reconnecting', 'error'

// Setter functions
function setWhatsAppClient(client) {
    whatsappClient = client;
}

function setQrCode(qr) {
    currentQrCode = qr;
}

function setStatus(status) {
    currentStatus = status;
    console.log(`📊 Status changed to: ${status}`);
}

function clearClientState() {
    whatsappClient = null;
    currentQrCode = null;
    currentStatus = 'disconnected';
    console.log('🗑️ Client state cleared.');
}

// Getter functions
function getWhatsAppClient() {
    return whatsappClient;
}

function getQrCode() {
    return currentQrCode;
}

function getStatus() {
    return currentStatus;
}

module.exports = {
    setWhatsAppClient,
    setQrCode,
    setStatus,
    clearClientState,
    getWhatsAppClient,
    getQrCode,
    getStatus
};