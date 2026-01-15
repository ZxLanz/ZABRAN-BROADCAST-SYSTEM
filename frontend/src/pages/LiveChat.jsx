import { useState, useEffect, useRef, useCallback } from 'react';
import axios from '../utils/axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import {
    Search, Send, MoreVertical,
    ArrowLeft, CheckCheck, MessageSquare, Trash2, X, UserPlus
} from 'lucide-react';
import DeleteConfirm from '../components/DeleteConfirm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function LiveChat() {
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeletingChat, setIsDeletingChat] = useState(false);

    const socketRef = useRef();
    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);

    // --- 1. HELPER FUNCTIONS (Defined FIRST to avoid ReferenceError/TDZ) ---

    // Normalize JID to clean phone number
    // Extract the actual phone number from remoteJid format
    const normalizePhone = (remoteJid) => {
        if (!remoteJid) return '';
        
        // Format: "628xxxxxx@s.whatsapp.net" or "628xxxxxx@lid" or "628xxx:45@lid"
        // Extract before @ symbol
        const beforeAt = String(remoteJid).split('@')[0];
        
        // Extract before : symbol (for LID format)
        const beforeColon = beforeAt.split(':')[0];
        
        // Remove all non-digits
        let phoneNumber = beforeColon.replace(/\D/g, '');
        
        // Convert 0xxx to 62xxx
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '62' + phoneNumber.substring(1);
        }
        
        // Return the phone number (or original if extraction failed)
        return phoneNumber || remoteJid;
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await axios.get('/chats');
            console.log('📞 Raw response:', data);
            if (data.success) {
                console.log('📞 Conversations from backend:', data.data.map(c => ({
                    _id: c._id,
                    displayName: c.displayName,
                    remoteJids: c.remoteJids
                })));
                setConversations(data.data);
            } else {
                console.error('❌ Response not success:', data);
            }
        } catch (err) {
            console.error('Failed to fetch chats', err);
        } finally {
            setIsLoadingChats(false);
        }
    }, []);

    const markAsRead = useCallback(async (jid) => {
        try {
            await axios.post(`/chats/${jid}/read`);
            // Update local state to clear badge
            setConversations(prev => prev.map(c =>
                c._id === jid ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    }, []);

    // --- 2. EFFECTS (Defined AFTER helpers) ---

    // Close menu on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Connect Socket
    useEffect(() => {
        socketRef.current = io(API_URL.replace('/api', ''), {
            withCredentials: true
        });

        socketRef.current.on('new_message', (data) => {
            const incomingMsg = data.message;
            const incomingPhone = incomingMsg.remoteJid.replace(/\D/g, '').split(':')[0];

            // Update conversation list
            setConversations(prev => {
                const newList = [...prev];
                // Match by ID OR by phone digits for robust deduplication
                const index = newList.findIndex(c =>
                    c._id === incomingMsg.remoteJid ||
                    (c._id.replace(/\D/g, '') === incomingPhone)
                );

                if (index !== -1) {
                    const updatedChat = { ...newList[index] };
                    updatedChat.lastMessage = incomingMsg;
                    // Move to top
                    newList.splice(index, 1);
                    newList.unshift(updatedChat);
                    // Increment unread if current chat is NOT open
                    if (selectedChat?._id !== updatedChat._id) {
                        updatedChat.unreadCount = (updatedChat.unreadCount || 0) + 1;
                    }
                    return newList;
                } else {
                    // Force refresh to get correct naming from backend
                    fetchConversations();
                    return prev;
                }
            });

            // If chat is open, handle message list
            if (selectedChat?._id === incomingMsg.remoteJid) {
                setMessages(prev => {
                    // 1. Robust Deduplication
                    // Check against Mongo ID AND Baileys Message ID (msgId)
                    // The backend sends 'msgId' which corresponds to the Baileys key.id
                    const exists = prev.some(m =>
                        m._id === incomingMsg._id ||
                        m._id === incomingMsg.msgId ||
                        (m.key && m.key.id === incomingMsg.msgId)
                    );

                    if (exists) return prev;

                    // 2. Aggressive Fuzzy Match for "Pending" (Optimistic) messages
                    // Use content & fromMe status. Ignore timestamp diffs.
                    const pendingIndex = prev.findIndex(m =>
                        m.status === 'pending' &&
                        m.content === incomingMsg.content &&
                        m.fromMe === incomingMsg.fromMe
                    );

                    if (pendingIndex !== -1) {
                        // Replace pending message with confirmed real message
                        const newMessages = [...prev];
                        newMessages[pendingIndex] = incomingMsg;
                        return newMessages;
                    }

                    // 3. If no duplicate found, append
                    setTimeout(scrollToBottom, 50);

                    // If message is incoming (not from me), mark it as read immediately
                    if (!incomingMsg.fromMe) {
                        markAsRead(selectedChat._id);
                    }
                    return [...prev, incomingMsg];
                });
            }
        });

        socketRef.current.on('message_revoked', (data) => {
            if (selectedChat?._id === data.remoteJid) {
                setMessages(prev => prev.filter(m =>
                    m._id !== data.msgId &&
                    m.msgId !== data.msgId &&
                    (!m.key || m.key.id !== data.msgId)
                ));
            }
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [selectedChat, fetchConversations, markAsRead]);

    // Initial Fetch
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Fetch Messages when chat selected
    useEffect(() => {
        if (!selectedChat) return;

        // 1. Mark as read
        if (selectedChat.unreadCount > 0) {
            markAsRead(selectedChat._id);
        }

        const fetchMessages = async () => {
            setIsLoadingMessages(true);
            try {
                const { data } = await axios.get(`/chats/${selectedChat._id}?limit=100`);
                if (data.success) {
                    setMessages(data.data);
                    scrollToBottom();
                }
            } catch (err) {
                console.error('Failed to fetch messages', err);
                toast.error('Gagal memuat pesan');
            } finally {
                setIsLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedChat, markAsRead]);

    // --- 3. EVENT HANDLERS ---

    const handleDeleteChat = () => {
        if (!selectedChat) return;
        setShowDeleteModal(true);
    };

    const confirmDeleteChat = async () => {
        if (!selectedChat) return;
        
        try {
            setIsDeletingChat(true);
            await axios.delete(`/chats/${selectedChat._id}`);
            toast.success('Chat berhasil dihapus');
            setConversations(prev => prev.filter(c => c._id !== selectedChat._id));
            setSelectedChat(null);
            setMessages([]);
            setShowDeleteModal(false);
            setShowMenu(false);
        } catch (err) {
            toast.error('Gagal menghapus chat');
        } finally {
            setIsDeletingChat(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedChat) return;

        const tempId = Date.now().toString();
        const tempMsg = {
            _id: tempId,
            content: inputText,
            fromMe: true,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        // Optimistic Update
        setMessages(prev => [...prev, tempMsg]);
        setInputText('');
        scrollToBottom();

        // Move conversation to top
        setConversations(prev => {
            const newList = [...prev];
            const index = newList.findIndex(c => c._id === selectedChat._id);
            if (index !== -1) {
                const item = newList.splice(index, 1)[0];
                item.lastMessage = tempMsg;
                newList.unshift(item);
                return newList;
            }
            return prev;
        });

        try {
            const { data } = await axios.post(`/chats/${selectedChat._id}/send`, {
                message: tempMsg.content
            });

            if (data.success) {
                // Update the temp message with real ID and Status
                setMessages(prev => prev.map(m =>
                    m._id === tempId ? { ...m, status: 'sent', _id: data.data.id, key: { id: data.data.id } } : m
                ));
            }
        } catch (err) {
            console.error('Send failed', err);
            const errMsg = err.response?.data?.details || err.message || 'Gagal mengirim pesan';
            toast.error(errMsg);
            setMessages(prev => prev.filter(m => m._id !== tempId));
        }
    };

    // Filter chats - search by display name, phone number, or last message content
    const filteredChats = conversations.filter(c => {
        // Skip if _id is null or invalid
        if (!c._id) return false;
        
        const query = searchQuery.toLowerCase();
        const displayName = (c.displayName || c.lastMessage?.pushName || '').toLowerCase();
        const phoneNumber = String(c._id).toLowerCase();
        const lastMsg = (c.lastMessage?.content || '').toLowerCase();

        // Support searching with or without '+' prefix
        const queryClean = query.startsWith('+') ? query.slice(1) : query;
        const phoneClean = phoneNumber.includes('@') ? phoneNumber.split('@')[0] : phoneNumber;

        return displayName.includes(query) ||
            phoneClean.includes(queryClean) ||
            lastMsg.includes(query);
    });

    // Filter messages for current chat if message search is active
    const filteredMessages = messages.filter(msg => {
        if (!isMessageSearchOpen || !messageSearchQuery.trim()) return true;
        return (msg.content || '').toLowerCase().includes(messageSearchQuery.toLowerCase());
    });

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50 font-roboto">

            {/* LEFT: Chat List */}
            <div className={`w-full md:w-[380px] bg-white border-r border-gray-200 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>

                {/* Header */}
                <div className="p-4 bg-navy-900 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-primary-400" />
                            Live Chat
                        </h2>
                        <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-primary-400 font-bold border border-navy-600">
                            ME
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Cari kontak atau chat..."
                            className="w-full pl-10 pr-4 py-2 bg-navy-800 border-none rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 text-sm transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoadingChats ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-400 text-sm">Memuat chat...</p>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <p className="text-gray-500 text-sm">Belum ada percakapan.<br />Pesan baru akan muncul di sini.</p>
                        </div>
                    ) : (
                        filteredChats.map(chat => {
                            const isActive = selectedChat?._id === chat._id;
                            // chat._id adalah phoneNumber clean dari backend (sudah dinormalisasi)
                            // chat.displayName sudah berisi nama lengkap atau "Unknown Contact"
                            const phoneNumber = chat._id;
                            const displayName = chat.displayName || 'Unknown Contact';
                            // Di chat list, tampilkan hanya nama saja (tanpa nomor)
                            const name = displayName;
                            const lastMsg = chat.lastMessage?.content || '[Media]';
                            const time = chat.lastMessage?.timestamp ? new Date(chat.lastMessage?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            const unread = chat.unreadCount > 0;

                            return (
                                <div
                                    key={chat._id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`p-4 flex gap-3 cursor-pointer transition-colors border-b border-gray-50 hover:bg-gray-50
                                ${isActive ? 'bg-primary-50/50 border-r-4 border-r-primary-500' : ''}
                            `}
                                >
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-navy-600 to-navy-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-sm border border-navy-400/20">
                                        {name[0]?.toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h3 className={`font-semibold truncate text-[15px] ${isActive ? 'text-navy-900' : 'text-gray-900'}`}>
                                                {name}
                                            </h3>
                                            <span className={`text-[11px] font-medium flex-shrink-0 ${unread ? 'text-primary-600' : 'text-gray-400'}`}>
                                                {time}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-[13px] truncate max-w-[90%] ${unread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                                {chat.lastMessage?.fromMe && <span className="text-gray-400 mr-1">Anda:</span>}
                                                {lastMsg}
                                            </p>
                                            {unread && (
                                                <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold shadow-sm shadow-primary-500/30">
                                                    {chat.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT: Chat Room */}
            <div className={`flex-1 bg-[#efeae2] flex flex-col relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />

                {selectedChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-600">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>

                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-navy-600 to-navy-500 flex items-center justify-center text-white font-bold text-sm">
                                    {(selectedChat.displayName || (!selectedChat.lastMessage?.fromMe && selectedChat.lastMessage?.pushName) || selectedChat._id)[0].toUpperCase()}
                                </div>

                                <div className="flex flex-col">
                                    <h3 className="font-bold text-navy-900 text-sm leading-tight">
                                        {selectedChat.displayName || 'Unknown Contact'}
                                    </h3>
                                    <p className="text-xs text-green-600 font-medium">
                                        {selectedChat.cleanPhone ? `+${selectedChat.cleanPhone}` : '(Nomor tidak tersedia)'}
                                    </p>
                                </div>

                                {/* QUICK SAVE TO CUSTOMER */}
                                {selectedChat && !selectedChat.displayName?.includes('(') && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                // Gunakan cleanPhone dari backend (sudah normalized)
                                                const phone = selectedChat.cleanPhone || normalizePhone(selectedChat._id);
                                                const name = selectedChat.displayName || selectedChat.lastMessage?.pushName || `User ${phone}`;
                                                
                                                // Jika phone tidak valid (null), jangan save
                                                if (!phone) {
                                                    toast.error('Nomor tidak valid - tidak bisa disimpan');
                                                    return;
                                                }
                                                
                                                await axios.post('/customers', { name, phone });
                                                toast.success('Kontak disimpan ke Customers!');
                                                fetchConversations(); // Refresh names
                                            } catch (err) {
                                                toast.error(err.response?.data?.message || 'Gagal menyimpan kontak');
                                            }
                                        }}
                                        className="ml-2 px-3 py-1 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full border border-primary-200 hover:bg-primary-500 hover:text-white transition-all flex items-center gap-1 shadow-sm"
                                        title="Simpan sebagai Customer"
                                    >
                                        <UserPlus className="w-3 h-3" />
                                        SAVE
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 relative" ref={menuRef}>
                                {isMessageSearchOpen ? (
                                    <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Cari pesan..."
                                            className="bg-transparent border-none focus:ring-0 text-xs w-32 md:w-48 text-gray-700"
                                            value={messageSearchQuery}
                                            onChange={e => setMessageSearchQuery(e.target.value)}
                                        />
                                        <button
                                            onClick={() => {
                                                setIsMessageSearchOpen(false);
                                                setMessageSearchQuery('');
                                            }}
                                            className="p-1 hover:bg-gray-200 rounded-full"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsMessageSearchOpen(true)}
                                        className="p-2 hover:bg-gray-100 rounded-full"
                                        title="Cari di chat"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    className="p-2 hover:bg-gray-100 rounded-full"
                                    title="Opsi Lain"
                                    onClick={() => setShowMenu(!showMenu)}
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>

                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50">
                                        <button
                                            onClick={handleDeleteChat}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Hapus Chat
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-0 custom-scrollbar">
                            {filteredMessages.length === 0 && messageSearchQuery ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Search className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">Tidak ada pesan yang cocok</p>
                                </div>
                            ) : filteredMessages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                max-w-[80%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm text-sm relative group
                                ${msg.fromMe
                                            ? 'bg-primary-500 text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 rounded-tl-none'}
                            `}>
                                        {/* Handle image messages */}
                                        {msg.content === '[Image]' || msg.messageType === 'image' ? (
                                            <div className="bg-gray-200 rounded w-48 h-48 flex items-center justify-center text-gray-500 mb-2">
                                                <span className="text-xs">📸 Image</span>
                                            </div>
                                        ) : null}
                                        
                                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>

                                        <div className={`
                                    text-[10px] mt-1 flex items-center justify-end gap-1 select-none
                                    ${msg.fromMe ? 'text-primary-100' : 'text-gray-400'}
                                `}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.fromMe && (
                                                <CheckCheck className={`w-3 h-3 ${msg.status === 'read' ? 'text-blue-300' : 'opacity-70'}`} />
                                            )}
                                        </div>

                                        <div className={`
                                    absolute top-0 w-3 h-3
                                    ${msg.fromMe
                                                ? '-right-1.5 bg-primary-500 [clip-path:polygon(0_0,0%_100%,100%_0)]'
                                                : '-left-1.5 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]'}
                                `} />
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-200 z-10">
                            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-2">

                                <div className="flex-1 bg-white border border-gray-300 rounded-2xl flex items-center shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                                    <textarea
                                        rows={1}
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                        placeholder="Ketik pesan..."
                                        className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 text-sm resize-none max-h-32 text-gray-800 placeholder-gray-400"
                                        style={{ minHeight: '44px' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="p-3 bg-navy-900 text-white rounded-full hover:bg-navy-800 disabled:opacity-50 disabled:hover:bg-navy-900 transition-all shadow-md active:scale-95"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <MessageSquare className="w-16 h-16 text-gray-300" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-navy-900 mb-2">Selamat Datang di Live Chat</h3>
                        <p className="text-gray-500 max-w-sm leading-relaxed">
                            Pilih percakapan dari daftar di sebelah kiri untuk mulai mengirim pesan secara real-time.
                        </p>
                        <div className="mt-8 flex gap-4 text-xs text-gray-400 font-medium tracking-wide uppercase">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Online</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500"></span> Real-time</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-navy-900"></span> Secure</span>
                        </div>
                    </div>
                )}

            </div>

            {/* Delete Chat Modal */}
            <DeleteConfirm
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDeleteChat}
                title="Hapus Percakapan"
                message={`Yakin ingin menghapus riwayat chat dengan ${selectedChat?.displayName || 'Unknown Contact'}? Pesan akan hilang permanen dan tidak dapat dipulihkan.`}
                isLoading={isDeletingChat}
            />
        </div>
    );
}
