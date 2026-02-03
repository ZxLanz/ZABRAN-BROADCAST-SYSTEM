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
    mediaUrl: { // Public URL e.g. /media/xxx.jpg
        type: String
    },
    mediaPath: { // Internal file path
        type: String
    },
    mediaType: { // MIME type e.g. image/jpeg
        type: String
    },
    status: { // sent, delivered, read (only for outgoing)
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    timestamp: {
        type: Date,
        required: true
    },
    pushName: { // Name of the sender (if incoming)
        type: String
    },
    extractedPhone: { // Helper field for searching/indexing
        type: String,
        index: true
    },
    quotedMsg: { // Context for replies
        content: String,
        participant: String,
        id: String
    },
    reactions: [{
        text: String, // Emoji
        senderId: String, // JID of reactor
        timestamp: Date
    }]
}, {
    timestamps: true
});

// ✅ COMPOUND INDEX FOR AGGREGATION PERFORMANCE
// Handles: { userId: ..., messageType: { $nin: ... } } + sort({ timestamp: -1 })
chatMessageSchema.index({ userId: 1, messageType: 1, timestamp: -1 });
chatMessageSchema.index({ userId: 1, timestamp: -1 }); // ✅ NEW: Generic timestamp sort for fast load
chatMessageSchema.index({ userId: 1, remoteJid: 1, timestamp: -1 }); // Optimizes finding messages in room

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
