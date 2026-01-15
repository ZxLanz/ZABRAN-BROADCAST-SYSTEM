const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const { authenticate } = require('../middleware/auth');
const { getSocket, socketsMap } = require('../utils/whatsappClient');

// Middleware to ensure user is logged in
router.use(authenticate);

// Helper to normalize JID - extracts phone number only to group conversations correctly
function normalizeJid(jid) {
    if (!jid) return null;
    
    // Extract before @ symbol
    const beforeAt = jid.split('@')[0];
    
    // For @lid format: "268165:20864989894@lid" → extract both parts and combine
    // For @s.whatsapp.net format: "628xxx@s.whatsapp.net" → just extract the number
    let phoneNumber = '';
    
    if (jid.includes('@lid')) {
        // @lid format: combine all digits from "xxx:yyy" format
        phoneNumber = beforeAt.replace(/\D/g, ''); // Remove all non-digits, keep them all
    } else {
        // @s.whatsapp.net format: take only before colon
        const beforeColon = beforeAt.split(':')[0];
        phoneNumber = beforeColon.replace(/\D/g, '');
    }
    
    // Ensure format 62xxx (convert 0xxx to 62xxx)
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
    }
    
    if (!phoneNumber) {
        console.warn(`⚠️ Could not extract phone from: "${jid}"`);
        return null;
    }
    
    return phoneNumber;
}

// 1. GET /chats - Get list of conversations
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get all messages
        const allMessages = await ChatMessage.find({ userId })
            .sort({ timestamp: -1 })
            .lean();

        // Group by normalized phone number (for deduplication)
        // But keep track of original remoteJids
        const chatsMap = new Map();
        
        for (const msg of allMessages) {
            const remoteJid = msg.remoteJid;
            
            if (!remoteJid) {
                console.warn(`⏭️  Skipping message with empty remoteJid`);
                continue;
            }
            
            // Use remoteJid as primary key (will deduplicate after getting displayName)
            if (!chatsMap.has(remoteJid)) {
                chatsMap.set(remoteJid, {
                    remoteJid: remoteJid,
                    lastMessage: msg,
                    allMessages: [msg],
                    unreadCount: 0
                });
            } else {
                const chat = chatsMap.get(remoteJid);
                chat.allMessages.push(msg);
                if (!msg.fromMe && msg.status !== 'read') {
                    chat.unreadCount += 1;
                }
            }
        }

        // Pre-load customers untuk lookup nomor berdasarkan nama (dan sebaliknya)
        const Customer = require('../models/Customer');
        let customersByName = new Map();  // name → phone
        let customersByPhone = new Map(); // phone → name
        try {
            const customers = await Customer.find({ userId: userId }).select('name phone').lean();
            customers.forEach(c => {
                if (c.name && c.phone) {
                    customersByName.set(c.name.toLowerCase(), c.phone);
                    // Juga store reverse mapping: normalized phone → name
                    const normalizedPhone = c.phone.replace(/\D/g, '');
                    if (normalizedPhone) {
                        customersByPhone.set(normalizedPhone, c.name);
                    }
                }
            });
        } catch (err) {
            console.warn('⚠️ Error loading customers:', err.message);
            // Continue anyway, just won't have customer lookup
        }

        // Convert to array and process
        let conversations = Array.from(chatsMap.values()).map(chat => {
            let displayName = null;
            
            // Priority 1: Pesan incoming (diterima) dengan pushName valid
            const incomingMsg = chat.allMessages.find(m => !m.fromMe && m.pushName && m.pushName !== 'Unknown');
            if (incomingMsg?.pushName) {
                displayName = incomingMsg.pushName;
            }
            
            // Priority 2: Jika belum ada, cari dari SEMUA pesan yang punya pushName valid
            if (!displayName) {
                const msgWithName = chat.allMessages.find(m => m.pushName && m.pushName !== 'Unknown');
                if (msgWithName?.pushName) {
                    displayName = msgWithName.pushName;
                }
            }
            
            // Priority 3: lastMessage fallback
            if (!displayName && chat.lastMessage?.pushName && chat.lastMessage.pushName !== 'Unknown') {
                displayName = chat.lastMessage.pushName;
            }
            
            // Default
            displayName = displayName || 'Unknown Contact';
            
            const lastMsg = chat.lastMessage;
            
            // Try to get phone number from extractedPhone field (if available)
            // Otherwise try to extract from remoteJid, or query Customer database
            let cleanPhone = null;
            
            // Priority 1: Check if any message has extractedPhone field
            const msgWithPhone = chat.allMessages.find(m => m.extractedPhone);
            if (msgWithPhone?.extractedPhone) {
                cleanPhone = msgWithPhone.extractedPhone;
            } else if (chat.remoteJid.includes('@s.whatsapp.net')) {
                // Priority 2: Try to extract from format @s.whatsapp.net
                const before = chat.remoteJid.split('@')[0].split(':')[0];
                cleanPhone = before.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone.substring(1);
                }
            } else if (chat.remoteJid.includes('@lid')) {
                // Priority 3: For @lid format, try to lookup phone from Customer database by name
                if (displayName && displayName !== 'Unknown Contact') {
                    const customerPhone = customersByName.get(displayName.toLowerCase());
                    if (customerPhone) {
                        cleanPhone = customerPhone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0')) {
                            cleanPhone = '62' + cleanPhone.substring(1);
                        }
                        console.log(`✅ Found phone from customer: "${displayName}" → ${cleanPhone}`);
                    }
                }
            }
            
            // Jika masih belum ada displayName tapi ada cleanPhone, coba lookup nama dari phone
            if ((!displayName || displayName === 'Unknown Contact') && cleanPhone) {
                const customerName = customersByPhone.get(cleanPhone);
                if (customerName) {
                    displayName = customerName;
                    console.log(`👤 Found name from customer phone: ${cleanPhone} → "${displayName}"`);
                }
            }
            
            // BONUS: Jika masih belum ada nama tapi ada cleanPhone, lookup dari customersByPhone
            if (displayName === 'Unknown Contact' && cleanPhone) {
                const nameFromPhone = customersByPhone.get(cleanPhone);
                if (nameFromPhone) {
                    displayName = nameFromPhone;
                    console.log(`✅ Found name from phone: ${cleanPhone} → "${displayName}"`);
                }
            }
            // For @lid format tanpa extractedPhone dan tanpa customer match, cleanPhone akan null
            
            return {
                _id: chat.remoteJid,
                cleanPhone: cleanPhone,
                displayName: displayName,
                lastMessage: {
                    content: lastMsg?.content,
                    timestamp: lastMsg?.timestamp,
                    fromMe: lastMsg?.fromMe,
                    pushName: lastMsg?.pushName
                },
                unreadCount: chat.unreadCount
            };
        });

        // ==================== DEDUPLICATION ====================
        // Group by displayName to merge duplicate entries
        const deduplicatedMap = new Map();
        
        conversations.forEach(conv => {
            const key = conv.displayName.toLowerCase();
            
            if (!deduplicatedMap.has(key)) {
                deduplicatedMap.set(key, conv);
            } else {
                // Keep the one with cleanPhone if available
                const existing = deduplicatedMap.get(key);
                if (conv.cleanPhone && !existing.cleanPhone) {
                    deduplicatedMap.set(key, conv);
                } else if (conv.lastMessage?.timestamp > existing.lastMessage?.timestamp) {
                    // Or keep the one with latest message
                    deduplicatedMap.set(key, conv);
                }
            }
        });

        conversations = Array.from(deduplicatedMap.values());

        // Sort by last message timestamp
        conversations.sort((a, b) => 
            (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)
        );

        // Debug log
        console.log('✅ Final conversations sent to frontend:');
        conversations.forEach(c => {
            console.log(`  - _id: "${c._id}" | normalized: "${c.normalizedPhone}" | name: "${c.displayName}"`);
        });

        res.json({ success: true, data: conversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
});

// 2. GET /chats/:jid - Get message history
router.get('/:jid', async (req, res) => {
    try {
        const userId = req.user.id;
        const { jid } = req.params;
        const { limit = 50, before } = req.query; // Pagination support

        // Normalize JID to match all variants (e.g., @s.whatsapp.net and @lid)
        const normalizedNumber = normalizeJid(jid);

        const query = {
            userId: userId,
            remoteJid: new RegExp(`^${normalizedNumber}[:\\@]`) // Match all JID formats
        };

        if (before) {
            query.timestamp = { $lt: new Date(before) };
        }

        const messages = await ChatMessage.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, data: messages.reverse() });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
});

// 3. POST /chats/:jid/send - Send a message
router.post('/:jid/send', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;
        const { message, type = 'text' } = req.body;

        const sock = socketsMap.get(userId);
        if (!sock) {
            console.log(`❌ Socket not found for user ${userId}. Available users: ${Array.from(socketsMap.keys()).join(', ')}`);
            return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
        }

        // Format JID: jika hanya nomor (clean), tambahkan @s.whatsapp.net
        let formattedJid = jid;
        if (!jid.includes('@')) {
            formattedJid = `${jid}@s.whatsapp.net`;
        }

        // Send via Baileys
        console.log(`📤 Sending message to ${formattedJid}: ${message}`);

        // Gunakan formatted JID
        const sentMsg = await sock.sendMessage(formattedJid, { text: message });

        console.log('✅ Message sent via socket:', sentMsg.key.id);

        res.json({ success: true, data: { id: sentMsg.key.id, status: 'sent' } });

    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message',
            details: error.message
        });
    }
});

// Mark messages as read
router.post('/:jid/read', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;

        // Normalize JID to match all variants
        const normalizedNumber = normalizeJid(jid);

        await ChatMessage.updateMany(
            {
                userId,
                remoteJid: new RegExp(`^${normalizedNumber}[:\\@]`),
                fromMe: false,
                status: { $ne: 'read' }
            },
            { $set: { status: 'read' } }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking read:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

// Delete chat history
router.delete('/:jid', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;

        // Normalize JID to delete all variants
        const normalizedNumber = normalizeJid(jid);

        await ChatMessage.deleteMany({
            userId,
            remoteJid: new RegExp(`^${normalizedNumber}[:\\@]`)
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

module.exports = router;
