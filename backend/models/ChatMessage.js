const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    remoteJid: { // The WhatsApp ID of the other person (e.g. 628xxx@s.whatsapp.net)
        type: String,
        required: true,
        index: true
    },
    fromMe: {
        type: Boolean,
        required: true
    },
    msgId: {
        type: String,
        required: true,
        unique: true
    },
    messageType: { // text, image, video, sticker, etc.
        type: String,
        default: 'text'
    },
    content: { // The text body or caption
        type: String,
        default: ''
    },
    mediaUrl: { // If image/video, where it is stored (optional for now)
        type: String
    },
    status: { // sent, delivered, read (only for outgoing)
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read'],
        default: 'sent'
    },
    timestamp: {
        type: Date,
        required: true
    },
    pushName: { // Name of the sender (if incoming)
        type: String
    },
    extractedPhone: { // Phone number extracted from remoteJid (if available)
        type: String,
        index: true
    }
}, {
    timestamps: true
});

// Compound index for fetching chat history efficiently
chatMessageSchema.index({ userId: 1, remoteJid: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
