
// Custom In-Memory Store Implementation for Baileys v7+
// Replicates the dropped makeInMemoryStore functionality

const makeInMemoryStore = ({ logger }) => {
    const chats = new Map();
    const messages = new Map();
    const contacts = new Map();
    const groupMetadata = new Map();
    const presences = new Map();
    const state = { connection: 'close' };

    const bind = (ev) => {
        ev.on('connection.update', (update) => {
            Object.assign(state, update);
        });

        ev.on('chats.set', ({ chats: newChats, isLatest }) => {
            if (isLatest) chats.clear();
            for (const chat of newChats) {
                chats.set(chat.id, Object.assign(chats.get(chat.id) || {}, chat));
            }
        });

        ev.on('contacts.set', ({ contacts: newContacts }) => {
            for (const contact of newContacts) {
                contacts.set(contact.id, Object.assign(contacts.get(contact.id) || {}, contact));
            }
        });

        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            if (type === 'append' || type === 'notify') {
                for (const msg of newMessages) {
                    const jid = msg.key.remoteJid;
                    const list = messages.get(jid) || [];

                    // Simple Dedupe
                    if (!list.find(m => m.key.id === msg.key.id)) {
                        list.push(msg);
                        // Limit to 50 for memory safety
                        if (list.length > 50) list.shift();
                    }
                    messages.set(jid, list);

                    // 🧠 CRITICAL FIX (Saint Zilan Request): 
                    // Capture PushName from message headers if contact is unknown
                    if (msg.pushName && jid) {
                        const existing = contacts.get(jid) || { id: jid };
                        // Update if name is new or different
                        if (existing.notify !== msg.pushName) {
                            contacts.set(jid, { ...existing, notify: msg.pushName });
                        }
                    }
                }
            }
        });

        ev.on('contacts.upsert', (newContacts) => {
            for (const contact of newContacts) {
                contacts.set(contact.id, Object.assign(contacts.get(contact.id) || {}, contact));
            }
        });

        // Add more handlers as needed (groups, etc)
    };

    const loadMessage = async (jid, id) => {
        const list = messages.get(jid);
        if (list) return list.find(m => m.key.id === id);
        return null;
    };

    const toJSON = () => ({
        chats: Object.fromEntries(chats),
        contacts: Object.fromEntries(contacts),
        messages: Object.fromEntries(messages)
    });

    const fromJSON = (json) => {
        if (json.chats) {
            for (const [id, chat] of Object.entries(json.chats)) {
                chats.set(id, chat);
            }
        }
        if (json.contacts) {
            for (const [id, contact] of Object.entries(json.contacts)) {
                contacts.set(id, contact);
            }
        }
    };

    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        bind,
        loadMessage,
        toJSON,
        fromJSON,
        writeToFile: (path) => {
            require('fs').writeFileSync(path, JSON.stringify(toJSON(), null, 2));
        },
        readFromFile: (path) => {
            if (require('fs').existsSync(path)) {
                const data = JSON.parse(require('fs').readFileSync(path, 'utf-8'));
                fromJSON(data);
            }
        }
    };
};

module.exports = makeInMemoryStore;
