import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import {
    MessageSquare, Send, Paperclip, MoreVertical, Search,
    Check, CheckCheck, Trash2, X, Image as ImageIcon, FileText,
    Smile, Download, Mic, StopCircle, User, Phone, Video, Plus, UserPlus, Save, ArrowLeft, Music, Reply, Edit // Added Reply icon
} from 'lucide-react';
import ChatAvatar from '../components/ChatAvatar';
import DeleteConfirm from '../components/DeleteConfirm';
import TagManagementModal from '../components/TagManagementModal';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function LiveChat() {
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null); // Lightbox State
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState(null); // Reply State
    const [customers, setCustomers] = useState([]); // Store customers for tagging logic
    const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');

    // Keep selectedChatRef synced
    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);




    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [presenceMap, setPresenceMap] = useState({}); // Map of JID -> Presence Data
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeletingChat, setIsDeletingChat] = useState(false);
    // Save Contact Modal State
    const [isSaveContactModalOpen, setIsSaveContactModalOpen] = useState(false);
    const [saveContactName, setSaveContactName] = useState('');

    const socketRef = useRef();
    const messagesEndRef = useRef(null);
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);
    const uploadTypeRef = useRef('document');
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [saveContactPhone, setSaveContactPhone] = useState('');
    const [saveContactTags, setSaveContactTags] = useState([]);
    const [saveContactTagInput, setSaveContactTagInput] = useState('');
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    // New Chat State
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [newChatName, setNewChatName] = useState('');

    // --- VOICE RECORDER STATE ---
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const chatContainerRef = useRef(null); // Ref for scroll container
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Format Duration (mm:ss)
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream; // ✅ Store stream in ref
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Convert to File
                const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });

                // Helper to send (reuse existing logic)
                await sendVoiceNote(audioFile);

                // Stop tracks safely
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start Timer
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            toast.error('Gagal mengakses mikrofon. Pastikan izin diberikan.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            // Stream cleanup happens in onstop
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            // Stop but don't process
            mediaRecorderRef.current.onstop = null; // Clear handler
            mediaRecorderRef.current.stop();

            // ✅ Stop tracks from Ref
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            setIsRecording(false);
            setRecordingDuration(0);
            clearInterval(timerRef.current);
        }
    };


    const sendVoiceNote = async (file) => {
        const toastId = toast.loading('Sending voice note...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'audio');

        try {
            const currentJid = selectedChat._id || selectedChat.remoteJid;
            let targetJid = currentJid;
            if (selectedChat.cleanPhone) targetJid = selectedChat.cleanPhone;

            await axios.post(`${API_URL}/chats/${targetJid}/send-media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Voice note sent!', { id: toastId });
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to send voice note', { id: toastId });
        }
    };

    // File Upload Handler
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setShowAttachMenu(false); // Close menu

        // Optimistic UI (Optional) or just Loading Toast
        const toastId = toast.loading('Sending media...');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', uploadTypeRef.current);
        // formData.append('caption', inputText); // Optional caption handling

        try {
            const currentJid = selectedChat._id || selectedChat.remoteJid;
            // Clean JID logic if needed
            let targetJid = currentJid;
            if (selectedChat.cleanPhone) targetJid = selectedChat.cleanPhone;

            await axios.post(`${API_URL}/chats/${targetJid}/send-media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Sent!', { id: toastId });
            setInputText(''); // Clear caption if we supported it
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to send media', { id: toastId });
        }

        // Reset input
        e.target.value = '';
    };

    const triggerFileUpload = (type) => {
        uploadTypeRef.current = type;
        if (fileInputRef.current) {
            let accept = '*/*';
            if (type === 'image') accept = 'image/*';
            else if (type === 'video') accept = 'video/*';
            else if (type === 'audio') accept = 'audio/*';

            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

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
        // Use 'auto' behavior for instant jump as requested
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    };

    const fetchConversations = useCallback(async () => {
        try {
            const { data } = await axios.get('/chats');

            if (data.success) {

                setConversations(data.data);
            } else {

            }
        } catch (err) {
            console.error('Failed to fetch chats', err);
        } finally {
            setIsLoadingChats(false);
        }
    }, []);

    const markAsRead = useCallback(async (chatOrJid) => {
        try {
            const jid = chatOrJid._id || chatOrJid;
            const payload = {};
            if (chatOrJid.mergedJids && Array.isArray(chatOrJid.mergedJids)) {
                payload.jids = chatOrJid.mergedJids;
            }

            await axios.post(`/chats/${jid}/read`, payload);

            // Update local state to clear badge
            setConversations(prev => prev.map(c =>
                c._id === jid ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    }, []);

    const fetchCustomers = useCallback(async () => {
        try {
            const { data } = await axios.get('/customers');
            if (data.success) {
                setCustomers(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch customers for tags', error);
        }
    }, []);

    // Helper to get tags for a chat
    const getTagsForChat = (chat) => {
        if (!chat || !customers.length) return [];
        // Chat ID usually contains phone number
        const chatPhone = normalizePhone(chat._id);

        // Find customer with matching phone
        const customer = customers.find(c => {
            // Basic match (backend should ensure uniqueness)
            return c.phone === chatPhone || (c.phone && chatPhone.endsWith(c.phone));
        });

        return customer ? (customer.tags || []) : [];
    };

    const getCustomerIdForChat = (chat) => {
        if (!chat || !customers.length) return null;
        const chatPhone = normalizePhone(chat._id);
        const customer = customers.find(c => {
            return c.phone === chatPhone || (c.phone && chatPhone.endsWith(c.phone));
        });
        return customer ? customer._id : null;
    };

    const handleTagsUpdated = (newTags) => {
        if (!selectedChat) return;

        const customerId = getCustomerIdForChat(selectedChat);
        if (customerId) {
            setCustomers(prev => prev.map(c =>
                c._id === customerId ? { ...c, tags: newTags } : c
            ));
        }
    };

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

    // Socket Connection
    useEffect(() => {
        const userId = localStorage.getItem('userId'); // Assuming stored
        if (!userId) return;

        // Only connect if not already connected (or handle strict mode)
        // socketRef.current = io(...); 
        // For simplicity reusing existing logic but fixing dependencies:

        const newSocket = io(API_URL.replace('/api', ''), {
            query: { userId: user ? user.id : '' }
        });
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            console.log('🔌 Connected to WebSocket');
            // Re-join rooms if needed
        });

        newSocket.on('new_message', (data) => {
            const incomingMsg = data.message;
            if (incomingMsg.userId !== user.id) return; // Prevent cross-user data (if shared socket)

            setConversations(prev => {
                const newList = [...prev];
                // Match by ID OR by phone digits for robust deduplication
                const index = newList.findIndex(c =>
                    c._id === incomingMsg.remoteJid ||
                    normalizePhone(c._id) === normalizePhone(incomingMsg.remoteJid)
                );

                if (index !== -1) {
                    const updatedChat = { ...newList[index] };
                    updatedChat.lastMessage = incomingMsg;
                    updatedChat.lastMessageTime = incomingMsg.timestamp;

                    // Move to top
                    newList.splice(index, 1);
                    newList.unshift(updatedChat);

                    // ✅ FIXED: Use Ref for check to avoid dependency loop
                    const currentSelected = selectedChatRef.current;
                    if (currentSelected && normalizePhone(currentSelected._id) === normalizePhone(updatedChat._id)) {
                        updatedChat.unreadCount = 0;
                    } else {
                        updatedChat.unreadCount = (updatedChat.unreadCount || 0) + 1;
                    }

                    return newList;
                } else {
                    // ❌ REMOVED SIDE EFFECT: fetchConversations() inside setter
                    // Ideally we should just append it or trigger a fetch outside.
                    // For now, let's just ignore to prevent crash/loop.
                    return prev;
                }
            });

            // If chat is open, handle message list
            const currentSelected = selectedChatRef.current;
            if (currentSelected && normalizePhone(currentSelected._id) === normalizePhone(incomingMsg.remoteJid)) {
                setMessages(prev => {
                    // 1. Robust Deduplication
                    const exists = prev.some(m => {
                        // Check exact ID match
                        if (m._id === incomingMsg._id ||
                            m.msgId === incomingMsg.msgId ||
                            (m.key && m.key.id === incomingMsg.msgId)) {
                            return true;
                        }

                        // Check Content + Timestamp proximity (Fallback for ID mismatch)
                        // If same content, same sender, and time diff < 5 seconds
                        const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(incomingMsg.timestamp).getTime());
                        if (m.content === incomingMsg.content &&
                            m.fromMe === incomingMsg.fromMe &&
                            timeDiff < 5000) {
                            return true;
                        }

                        return false;
                    });

                    if (exists) return prev;

                    // 2. Optimistic Update Replacement
                    const pendingIndex = prev.findIndex(m =>
                        m.status === 'pending' &&
                        m.content === incomingMsg.content &&
                        m.fromMe === incomingMsg.fromMe
                    );

                    if (pendingIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[pendingIndex] = incomingMsg;
                        return newMessages;
                    }

                    setTimeout(scrollToBottom, 50);

                    if (!incomingMsg.fromMe) {
                        markAsRead(selectedChat);
                    }
                    return [...prev, incomingMsg];
                });
            }
        });

        socketRef.current.on('message_status_update', (data) => {
            console.log('✅ Status Update:', data);
            setMessages(prev => prev.map(m => {
                // Match by msgId (DB field) or key.id (Baileys object structure)
                if (m.msgId === data.messageId || (m.key && m.key.id === data.messageId)) {
                    // Update status locally
                    return { ...m, status: data.status };
                }
                return m;
            }));
        });

        socketRef.current.on('message_reaction', (data) => {
            // console.log('❤️ Reaction Update:', data);
            setMessages(prev => prev.map(m => {
                if (m.msgId === data.msgId || (m.key && m.key.id === data.msgId)) {
                    return { ...m, reactions: data.reactions };
                }
                return m;
            }));
        });

        // ✅ Listen for Presence Updates (Typing/Online)
        socketRef.current.on('presence_update', (data) => {
            setPresenceMap(prev => {
                const newMap = { ...prev };
                newMap[data.chatJid] = data.presences;
                return newMap;
            });
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
        fetchCustomers();
    }, [fetchConversations, fetchCustomers]);

    // Handle "Start Chat" from Customers Page
    const location = useLocation();
    useEffect(() => {
        if (location.state?.startChat && !isLoadingChats) {
            const customer = location.state.startChat;
            const targetPhone = normalizePhone(customer.phone);

            // 1. Try to find existing conversation
            const existingChat = conversations.find(c =>
                normalizePhone(c._id) === targetPhone
            );

            if (existingChat) {
                setSelectedChat(existingChat);
            } else {
                // 2. If not found, create a temporary chat object to open the window
                const newJid = targetPhone + '@s.whatsapp.net';
                setSelectedChat({
                    _id: newJid,
                    remoteJid: newJid,
                    displayName: customer.name,
                    unreadCount: 0,
                    lastMessage: null,
                    isTemporary: true // Marker
                });
            }
            // Clear state so it doesn't re-trigger on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state, conversations, isLoadingChats]);

    // Mark read when selecting chat
    useEffect(() => {
        if (selectedChat && selectedChat.unreadCount > 0) {
            console.log('👀 [READ] Marking chat as read:', selectedChat.displayName);

            // 1. Backend Call
            markAsRead(selectedChat);

            // 2. Immediate Local Update (Fix Persistence)
            setConversations(prev => prev.map(c =>
                normalizePhone(c._id) === normalizePhone(selectedChat._id) ? { ...c, unreadCount: 0 } : c
            ));

            // 3. Update Selected Chat State too
            setSelectedChat(prev => ({ ...prev, unreadCount: 0 }));
        }
    }, [selectedChat, markAsRead]);

    // Fetch Messages when chat selected
    useEffect(() => {
        if (!selectedChat) return;

        const fetchMessages = async () => {
            setIsLoadingMessages(true);
            try {
                const { data } = await axios.get(`/chats/${selectedChat._id}?limit=50`);
                if (data.success) {
                    setMessages(data.data);
                    setHasMoreMessages(data.data.length >= 50); // Assume limit is 50
                    // Force scroll nicely
                    setTimeout(() => scrollToBottom(), 100);
                }
            } catch (err) {
                console.error('Failed to fetch messages', err);
                toast.error('Gagal memuat pesan');
            } finally {
                setIsLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedChat]);

    // Lazy Load Function
    const loadMoreMessages = async () => {
        if (!selectedChat || isLoadingMore || !hasMoreMessages || messages.length === 0) return;

        setIsLoadingMore(true);
        const oldestMessage = messages[0];
        const beforeTimestamp = oldestMessage.timestamp;

        // Capture current scroll height before update
        const container = chatContainerRef.current;
        const previousHeight = container.scrollHeight;
        const previousTop = container.scrollTop;

        try {
            const { data } = await axios.get(`/chats/${selectedChat._id}?limit=50&before=${beforeTimestamp}`);

            if (data.success && data.data.length > 0) {
                // Prepend new messages
                setMessages(prev => [...data.data, ...prev]);

                // Determine if there are even more
                if (data.data.length < 50) {
                    setHasMoreMessages(false);
                }

                // Restore scroll position after DOM update
                // We need to wait for layout repaint
                // Restore scroll position after DOM update
                // We need to wait for layout repaint - setTimeout(0) is more reliable than rAF here due to React batching
                setTimeout(() => {
                    if (container) {
                        const newHeight = container.scrollHeight;
                        container.scrollTop = newHeight - previousHeight;
                    }
                }, 0);

            } else {
                setHasMoreMessages(false);
            }
        } catch (err) {
            console.error('Failed to load more messages', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Scroll Handler
    const handleScroll = (e) => {
        const { scrollTop } = e.target;
        if (scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
            loadMoreMessages();
        }
    };

    // Auto-scroll on new messages (Only if near bottom OR if it's the initial load)
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    const handleSaveContactClick = () => {
        let defaultName = selectedChat.displayName;
        if (defaultName === 'Unknown Contact') {
            defaultName = selectedChat.lastMessage?.pushName || '';
        }
        setSaveContactName(defaultName);
        const contactPhone = selectedChat.cleanPhone || normalizePhone(selectedChat._id);
        setSaveContactPhone(contactPhone ? `+${contactPhone}` : selectedChat._id.split('@')[0]);
        setSaveContactTags([]); // Reset tags
        setSaveContactTagInput('');
        setIsSaveContactModalOpen(true);
    };

    const handleSaveContactConfirm = async () => {
        // Remove + and spaces from editable phone
        const phone = saveContactPhone.replace(/\D/g, '');
        if (!phone) {
            toast.error('Nomor tidak valid');
            return;
        }

        try {
            // Determine JID to link
            const jidToLink = selectedChat._id;

            await axios.post('/customers', {
                name: saveContactName.trim(),
                phone,
                jid: jidToLink,
                tags: saveContactTags
            });

            toast.success(`Kontak ${saveContactName} berhasil disimpan!`);
            setIsSaveContactModalOpen(false);

            // ✅ IMMEDIATE UPDATE: Manually update selectedChat state to hide SAVE button
            setSelectedChat(prev => ({
                ...prev,
                isSaved: true,
                displayName: saveContactName.trim()
            }));

            fetchConversations();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan kontak');
        }
    };

    const handleStartNewChat = async () => {
        if (!newChatNumber) return;

        let formatted = newChatNumber.replace(/\D/g, '');
        if (formatted.startsWith('0')) formatted = '62' + formatted.substring(1);
        if (formatted.startsWith('8')) formatted = '62' + formatted;

        if (formatted.length < 5) {
            toast.error('Nomor tidak valid');
            return;
        }

        // Check if exists in conversations
        const existing = conversations.find(c => normalizePhone(c._id) === formatted);

        if (existing) {
            setSelectedChat(existing);
        } else {
            // Create temporary chat object for UI
            const newChat = {
                _id: `${formatted}@s.whatsapp.net`,
                cleanPhone: formatted,
                displayName: `+${formatted}`,
                unreadCount: 0,
                isSaved: false,
                lastMessage: null,
                hasStandardJid: true
            };
            // Add to list optimistically
            setConversations(prev => [newChat, ...prev]);
            setSelectedChat(newChat);
        }

        setIsNewChatModalOpen(false);
        setNewChatNumber('');
    };

    // --- REPLY HANDLERS ---
    const handleReply = (msg) => {
        setReplyingTo(msg);
        // Focus input (optional but good UX)
        // document.querySelector('textarea')?.focus();
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!inputText.trim() && !selectedImage) || !selectedChat) return;

        const tempId = `temp-${Date.now()}`;
        const content = inputText;
        const tempMsg = {
            _id: tempId,
            key: { id: tempId },
            msgId: tempId,
            content: content,
            fromMe: true,
            timestamp: new Date().toISOString(),
            status: 'pending',
            remoteJid: selectedChat._id
        };

        // Optimistic Update
        setMessages(prev => [...prev, tempMsg]);
        setInputText('');
        scrollToBottom();

        try {
            const payload = {
                message: content,
                quotedMsgId: replyingTo ? (replyingTo.msgId || (replyingTo.key && replyingTo.key.id)) : null
            };

            // Clear reply state
            if (replyingTo) setReplyingTo(null);

            const { data } = await axios.post(`/chats/${selectedChat._id}/send`, payload);

            if (data.success) {
                // Update temp message
                setMessages(prev => prev.map(m =>
                    m._id === tempId ? { ...m, ...data.data, status: 'sent', _id: data.data.id, msgId: data.data.id, key: { id: data.data.id } } : m
                ));
            }


        } catch (err) {
            console.error('Send failed', err);
            const errMsg = err.response?.data?.details || err.message || 'Gagal mengirim pesan';
            toast.error(errMsg);
            setMessages(prev => prev.filter(m => m._id !== tempId));
        }
    };

    const handleSendReaction = async (msg, emoji) => {
        try {
            // Optimistic Update (Optional, waiting for socket is safer usually, but let's try strict socket reliance first)
            // Actually, for better UX let's wait for socket.

            await axios.post(`/chats/${selectedChat._id}/react`, {
                msgId: msg.msgId || (msg.key && msg.key.id),
                emoji,
                fromMe: msg.fromMe,
                participant: msg.participant
            });
        } catch (error) {
            console.error('Failed to react:', error);
            toast.error('Failed to send reaction');
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
            <div className={`w-full md:w-[380px] bg-white dark:bg-[#111b21] border-r border-gray-200 dark:border-gray-700 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>

                {/* Header */}
                <div className="p-4 bg-navy-900 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-primary-400" />
                            Live Chat
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsNewChatModalOpen(true)}
                                className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-600 flex items-center justify-center text-white transition-colors"
                                title="Mulai Chat Baru"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-primary-400 font-bold border border-navy-600">
                                ME
                            </div>
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
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Belum ada percakapan.<br />Pesan baru akan muncul di sini.</p>
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
                            const rawContent = chat.lastMessage?.content || '';
                            const lastMsg = rawContent === '[documentMessage]' ? '[Dokumen]' : rawContent === '[stickerMessage]' ? '[Sticker]' : (rawContent || '[Media]');
                            const time = chat.lastMessage?.timestamp ? new Date(chat.lastMessage?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            const unread = chat.unreadCount > 0;

                            return (
                                <div
                                    key={chat._id}
                                    onClick={() => {
                                        if (selectedChat?._id !== chat._id) {
                                            setMessages([]); // ✅ IMMEDATE CLEAR (Fixes Lag/Ghosting)
                                            setHasMoreMessages(false);
                                            setIsLoadingMessages(true);
                                            setSelectedChat(chat);
                                        }
                                    }}
                                    className={`p-4 flex gap-3 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#202c33]
                                ${isActive ? 'bg-primary-50/50 dark:bg-[#2a3942] border-r-4 border-r-primary-500' : ''}
                            `}
                                >
                                    {/* Avatar */}
                                    <ChatAvatar chat={chat} className="w-12 h-12" />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`font-semibold truncate text-[15px] ${isActive ? 'text-navy-900 dark:text-white' : 'text-gray-900 dark:text-gray-100'} ${unread ? 'font-bold' : ''}`}>
                                                        {name}
                                                    </h3>
                                                    {/* Tags inline with name */}
                                                    <div className="flex gap-1 shrink-0">
                                                        {getTagsForChat(chat).slice(0, 3).map((tag, i) => {
                                                            const lowerTag = tag.toLowerCase();
                                                            let colorClass = "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
                                                            if (lowerTag === 'royal') colorClass = "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
                                                            if (lowerTag === 'gold') colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
                                                            if (lowerTag === 'platinum') colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
                                                            if (lowerTag === 'vip') colorClass = "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

                                                            return (
                                                                <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${colorClass}`}>
                                                                    {tag}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-[11px] font-medium flex-shrink-0 ${unread ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {time}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <p className={`text-[13px] truncate max-w-[90%] ${unread ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
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
                        <div className="h-16 px-4 bg-white dark:bg-[#202c33] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full text-gray-600 dark:text-gray-300">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>

                                <ChatAvatar chat={selectedChat} className="w-9 h-9" />

                                <div className="flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        {/* Header Tags */}
                                        <div className="flex gap-1 shrink-0">
                                            {getTagsForChat(selectedChat).map((tag, i) => {
                                                const lowerTag = tag.toLowerCase();
                                                let colorClass = "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
                                                if (lowerTag === 'royal') colorClass = "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
                                                if (lowerTag === 'gold') colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
                                                if (lowerTag === 'platinum') colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
                                                if (lowerTag === 'vip') colorClass = "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

                                                return (
                                                    <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${colorClass}`}>
                                                        {tag}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        {/* Edit Tags Button */}
                                        <button
                                            onClick={() => setIsTagModalOpen(true)}
                                            className="p-2 ml-1 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-full transition-colors"
                                            title="Manage Tags"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* CHAT IDENTITY HEADER */}
                                    <div className="flex flex-col justify-center">
                                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-base">
                                            {selectedChat.displayName || (selectedChat.cleanPhone ? `+${selectedChat.cleanPhone}` : 'Unknown Contact')}
                                            {selectedChat.isSaved && selectedChat.hasStandardJid && (
                                                <span className="p-0.5 bg-green-100 dark:bg-green-900 rounded">
                                                    <MessageSquare size={12} className="text-green-600 dark:text-green-400" />
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                            {/* Subtitle: ~PushName or Number */}
                                            {!selectedChat.isSaved && selectedChat.pushName ? (
                                                <span className="italic text-gray-400">~{selectedChat.pushName}</span>
                                            ) : (
                                                <span>{selectedChat.cleanPhone ? `+${selectedChat.cleanPhone}` : ''}</span>
                                            )}

                                            {/* Presence Indicator */}
                                            {(() => {
                                                const rawJid = selectedChat._id;
                                                const presence = presenceMap[rawJid];
                                                if (presence) {
                                                    const participantValues = Object.values(presence);
                                                    if (participantValues.length > 0) {
                                                        const p = participantValues[0];
                                                        if (p.lastKnownPresence === 'composing') return <span className="text-green-500 font-bold animate-pulse ml-2">sedang mengetik...</span>;
                                                        if (p.lastKnownPresence === 'recording') return <span className="text-green-500 font-bold animate-pulse ml-2">merekam suara...</span>;
                                                        if (p.lastKnownPresence === 'available') return <span className="text-green-500 font-bold ml-2">• Online</span>;
                                                    }
                                                }
                                                return null;
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                {/* QUICK SAVE BUTTON */}
                                {selectedChat && !selectedChat.isSaved && !selectedChat.displayName?.includes('(') && (
                                    <button
                                        onClick={handleSaveContactClick}
                                        className="hidden md:flex ml-2 px-3 py-1 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full border border-primary-200 hover:bg-primary-500 hover:text-white transition-all items-center gap-1 shadow-sm"
                                        title="Simpan sebagai Customer"
                                    >
                                        <UserPlus className="w-3 h-3" />
                                        SAVE
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 relative" ref={menuRef}>
                                {isMessageSearchOpen ? (
                                    <div className="flex items-center bg-gray-100 dark:bg-[#2a3942] rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Cari pesan..."
                                            className="bg-transparent border-none focus:ring-0 text-xs w-32 md:w-48 text-gray-700 dark:text-gray-200"
                                            value={messageSearchQuery}
                                            onChange={e => setMessageSearchQuery(e.target.value)}
                                        />
                                        <button
                                            onClick={() => {
                                                setIsMessageSearchOpen(false);
                                                setMessageSearchQuery('');
                                            }}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsMessageSearchOpen(true)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full"
                                        title="Cari di chat"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full"
                                    title="Opsi Lain"
                                    onClick={() => setShowMenu(!showMenu)}
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>

                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <div className="absolute right-0 top-12 w-48 bg-white dark:bg-[#202c33] rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
                                        <button
                                            onClick={handleDeleteChat}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Hapus Chat
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-0 custom-scrollbar bg-[#efeae2] dark:bg-[#0b141a]"
                        >
                            {/* Loading More Spinner */}
                            {isLoadingMore && (
                                <div className="flex justify-center py-2">
                                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            {filteredMessages.length === 0 && messageSearchQuery ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Search className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">Tidak ada pesan yang cocok</p>
                                </div>
                            ) : filteredMessages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                relative group text-[14.2px] leading-[19px]
                                ${(msg.messageType === 'sticker' || msg.content === '[Sticker]')
                                            ? 'bg-transparent shadow-none p-0'
                                            : `shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${msg.mediaUrl ? 'p-1 rounded-xl max-w-[330px]' : 'px-3 py-1.5 rounded-lg max-w-[85%] md:max-w-[65%]'} 
                                            ${msg.fromMe ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'}
                                            ${msg.content && msg.content.includes('[AI]') ? 'border-l-4 border-l-purple-500 bg-[#f3e5f5] dark:bg-[#4a148c]/20' : ''}`}
                                text-[#111b21] dark:text-[#e9edef]
                            `}>
                                        {/* HANDLING MEDIA */}
                                        {msg.mediaUrl ? (
                                            <div className="relative overflow-hidden rounded-lg">
                                                {(msg.messageType === 'sticker' || (msg.content === '[Sticker]' && msg.mediaUrl)) ? (
                                                    <div className="relative">
                                                        <img
                                                            src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                                            alt="Sticker"
                                                            className="w-32 h-32 object-contain cursor-pointer transition-transform hover:scale-105"
                                                            onClick={() => setSelectedImage(`${API_URL.replace('/api', '')}${msg.mediaUrl}`)}
                                                        />
                                                    </div>
                                                ) : msg.mediaType?.startsWith('image/') ? (
                                                    <div className="relative">
                                                        <img
                                                            src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                                            alt="Sent Media"
                                                            className="w-full h-auto max-h-[400px] object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                                            onClick={() => setSelectedImage(`${API_URL.replace('/api', '')}${msg.mediaUrl}`)}
                                                        />
                                                        {/* Timestamp Overlay for Images */}
                                                        {(!msg.content || msg.content === '[Image]') && (
                                                            <div className="absolute bottom-0 right-0 w-full p-1.5 bg-gradient-to-t from-black/50 to-transparent flex justify-end items-center gap-1 rounded-b-lg">
                                                                <span className="text-[11px] text-white/90">
                                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                </span>
                                                                {msg.fromMe && (
                                                                    <CheckCheck size={15} className={`text-white/90 ${msg.status === 'read' ? 'text-blue-300' : ''}`} strokeWidth={1.5} />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : msg.mediaType?.startsWith('video/') ? (
                                                    <video
                                                        controls
                                                        className="w-full h-auto max-h-[400px] bg-black/5 rounded-lg"
                                                        src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                                    />
                                                ) : msg.mediaType?.startsWith('audio/') ? (
                                                    <audio
                                                        controls
                                                        className="w-full min-w-[250px] h-10 mt-1"
                                                        src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                                    />
                                                ) : (
                                                    <a
                                                        href={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                                                    >
                                                        <div className="p-2 bg-white rounded-full shadow-sm text-blue-600">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-sm font-medium text-gray-700 truncate">
                                                                File Attachment
                                                            </span>
                                                            <span className="text-xs text-blue-500 underline truncate max-w-[150px]">
                                                                Click to Download
                                                            </span>
                                                        </div>
                                                    </a>
                                                )}
                                            </div>
                                        ) : (msg.content === '[Image]' || msg.messageType === 'image') ? (
                                            <div className="bg-gray-100 rounded-lg w-full h-48 flex flex-col items-center justify-center text-gray-400 mb-2 border-2 border-dashed border-gray-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                <span className="text-xs font-medium">Image Placeholder</span>
                                            </div>
                                        ) : null}

                                        {/* QUOTED MESSAGE BLOCK */}
                                        {msg.quotedMsg && (
                                            <div className={`mb-1 rounded-[5px] overflow-hidden border-l-[4px] bg-black/5 dark:bg-black/20 p-1.5 cursor-pointer flex flex-col ${msg.fromMe ? 'border-[#069986] bg-[#cfe9ba] dark:bg-[#025144]' : 'border-[#917c9e] bg-[#f5f6f6] dark:bg-[#1f2c33]'}`}>
                                                <span className={`text-[11.5px] font-bold mb-0.5 ${msg.fromMe ? 'text-[#046a5d] dark:text-[#00a884]' : 'text-[#6e587b] dark:text-[#d1d7db]'}`}>
                                                    {msg.quotedMsg.participant?.split('@')[0] || 'User'}
                                                </span>
                                                <p className="text-[12px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-tight">
                                                    {msg.quotedMsg.content}
                                                </p>
                                            </div>
                                        )}

                                        {/* TEXT CONTENT (If exists and not just [Image]) */}
                                        {(!msg.mediaUrl || (msg.content && !msg.content.includes('[Image]') && !msg.content.includes('[Video]') && !msg.content.includes('[audioMessage]') && !msg.content.includes('[documentMessage]') && !msg.content.includes('[stickerMessage]') && !msg.content.includes('[Sticker]'))) && (
                                            <div className={`${msg.mediaUrl ? 'px-2 pb-1 pt-1' : 'px-2 py-1 relative'}`}>
                                                {/* Message Text with "Read More" like behavior if needed */}
                                                <div className="text-[14.2px] text-[#111b21] dark:text-[#e9edef] leading-[19px] whitespace-pre-wrap break-words">
                                                    {msg.content}

                                                    {/* Metadata/Timestamp Container - Uses float to sit at bottom right */}
                                                    <span className="inline-block align-bottom h-[15px] w-[60px]"></span> {/* Spacer to prevent overlap */}
                                                    <div className="float-right -mt-[6px] ml-2 flex items-center gap-1 h-[15px] select-none">
                                                        <span className="text-[11px] text-[hsla(0,0%,7%,0.45)] dark:text-[hsla(0,0%,100%,0.45)] relative top-[3px]">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                        {msg.fromMe && (
                                                            <span className={`relative top-[3px] ml-1 ${msg.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
                                                                {/* 
                                                                    1. Single Grey Tick: Sent / Pending (Offline)
                                                                    2. Double Grey Tick: Delivered (Online but not read)
                                                                    3. Double Blue Tick: Read
                                                                */}
                                                                {(msg.status === 'read') ? (
                                                                    <CheckCheck size={16} strokeWidth={1.5} />
                                                                ) : (msg.status === 'delivered') ? (
                                                                    <CheckCheck size={16} strokeWidth={1.5} />
                                                                ) : (
                                                                    <Check size={16} strokeWidth={1.5} />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* HOVER ACTIONS: REPLY & REACT */}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10 bg-white/80 dark:bg-black/40 rounded-full p-0.5 shadow-sm">
                                            {/* REACTION BUTTON WITH MENU */}
                                            <div className="relative group/reaction">
                                                <button
                                                    className="p-1 rounded-full text-gray-500 hover:text-yellow-500 transition-colors"
                                                    title="React"
                                                >
                                                    <Smile size={14} />
                                                </button>
                                                {/* EMOJI MENU (Hover) */}
                                                <div className="absolute bottom-full mb-2 right-0 hidden group-hover/reaction:flex bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-1 gap-1 animate-in zoom-in-95 duration-200 z-50">
                                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSendReaction(msg, emoji);
                                                            }}
                                                            className="hover:scale-125 transition-transform text-lg p-1"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleReply(msg)}
                                                className="p-1 rounded-full text-gray-500 hover:text-primary-500 transition-colors"
                                                title="Reply"
                                            >
                                                <Reply size={14} />
                                            </button>
                                        </div>

                                        {/* REACTIONS DISPLAY */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className="absolute -bottom-2 right-2 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-1 text-[10px] z-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                {(() => {
                                                    // Group reactions by text
                                                    const counts = {};
                                                    msg.reactions.forEach(r => {
                                                        counts[r.text] = (counts[r.text] || 0) + 1;
                                                    });
                                                    // Get top 3
                                                    const sortedEmojis = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);

                                                    return (
                                                        <>
                                                            {sortedEmojis.map(emoji => (
                                                                <span key={emoji}>{emoji}</span>
                                                            ))}
                                                            {msg.reactions.length > 1 && (
                                                                <span className="text-gray-500 dark:text-gray-400 font-medium ml-0.5">
                                                                    {msg.reactions.length}
                                                                </span>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-2 py-2 md:px-4 md:py-3 bg-[#f0f2f5] border-t border-gray-200 z-10 w-full relative">
                            <div className="max-w-4xl mx-auto flex items-end gap-2 relative">

                                {/* ATTACHMENT BUTTON & MENU */}
                                <div className="relative pb-1">
                                    {showAttachMenu && (
                                        <div className="absolute bottom-14 left-0 mb-2 flex flex-col gap-3 bg-white p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-2 fade-in duration-200 min-w-[160px] z-50">
                                            <button onClick={() => triggerFileUpload('image')} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-gray-700 group">
                                                <div className="p-2 bg-purple-100 group-hover:bg-purple-200 text-purple-600 rounded-full transition-colors">
                                                    <ImageIcon size={20} />
                                                </div>
                                                <span className="text-sm font-medium">Foto & Video</span>
                                            </button>
                                            <button onClick={() => triggerFileUpload('video')} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-gray-700 group">
                                                <div className="p-2 bg-pink-100/50 text-pink-600 rounded-full transition-colors">
                                                    <Video size={20} />
                                                </div>
                                                <span className="text-sm font-medium">Video</span>
                                            </button>
                                            <button onClick={() => triggerFileUpload('document')} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-gray-700 group">
                                                <div className="p-2 bg-blue-100 group-hover:bg-blue-200 text-blue-600 rounded-full transition-colors">
                                                    <FileText size={20} />
                                                </div>
                                                <span className="text-sm font-medium">Dokumen</span>
                                            </button>
                                            <button onClick={() => triggerFileUpload('audio')} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-gray-700 group">
                                                <div className="p-2 bg-orange-100 group-hover:bg-orange-200 text-orange-600 rounded-full transition-colors">
                                                    <Music size={20} />
                                                </div>
                                                <span className="text-sm font-medium">Audio</span>
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                                        className={`p-2 rounded-full transition-all ${showAttachMenu ? 'bg-gray-200 text-gray-600 rotate-45' : 'text-[#54656f] hover:bg-gray-200'}`}
                                    >
                                        <div className="flex items-center justify-center">
                                            {/* Plus Icon Style like WhatsApp */}
                                            <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M19,11h-6V5h-2v6H5v2h6v6h2v-6h6V11z"></path></svg>
                                        </div>
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                </div>



                                {/* REPLY BANNER */}
                                {replyingTo && (
                                    <div className="absolute bottom-full left-0 right-0 mx-2 mb-2 bg-white dark:bg-[#1f2c33] border-l-[4px] border-[#00a884] rounded-lg shadow-[0_-2px_5px_rgba(0,0,0,0.05)] p-2 flex justify-between items-center z-20 animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="flex flex-col overflow-hidden w-full mr-4 text-sm">
                                            <span className="font-bold text-[#00a884] mb-0.5">
                                                {replyingTo.fromMe ? 'Anda' : (replyingTo.pushName || 'User')}
                                            </span>
                                            <p className="text-gray-500 dark:text-gray-300 truncate">
                                                {replyingTo.content}
                                            </p>
                                        </div>
                                        <button onClick={cancelReply} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400">
                                            <X size={18} />
                                        </button>
                                    </div>
                                )}

                                {/* INPUT FORM OR RECORDER UI */}
                                {isRecording ? (
                                    <div className="flex-1 flex items-center justify-between bg-white rounded-lg p-2 px-4 shadow-sm border border-red-100 animate-in fade-in duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                            <span className="text-red-600 font-mono font-medium text-lg min-w-[50px]">
                                                {formatDuration(recordingDuration)}
                                            </span>
                                            <span className="text-sm text-gray-500">Merekam...</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={cancelRecording}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                title="Batal"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="p-2 bg-[#00a884] text-white hover:bg-[#008f6f] rounded-full transition-colors shadow-sm"
                                                title="Kirim"
                                            >
                                                <Send size={18} className="translate-x-0.5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSendMessage} className="flex-1 flex items-end gap-2">
                                        <div className="flex-1 bg-white rounded-lg flex items-center shadow-sm border border-white focus-within:border-white py-1 transition-all">
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
                                                placeholder="Ketik pesan"
                                                className="w-full px-4 py-2 bg-transparent border-none focus:ring-0 text-[15px] resize-none max-h-32 text-[#111b21] placeholder-[#54656f] leading-6"
                                                style={{ minHeight: '24px', maxHeight: '100px' }}
                                            />
                                        </div>

                                        {inputText.trim() ? (
                                            <button
                                                type="submit"
                                                className="p-2.5 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-all shadow-sm mb-1"
                                            >
                                                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                                            </button>
                                        ) : (
                                            // Real Voice Recorder Trigger
                                            <button
                                                type="button"
                                                onClick={startRecording}
                                                className="p-2.5 text-[#54656f] hover:bg-gray-200 rounded-full transition-all mb-1"
                                                title="Tahan untuk merekam"
                                            >
                                                <Mic size={24} />
                                            </button>
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center mb-6 shadow-sm">
                            <MessageSquare className="w-16 h-16 text-gray-300" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-navy-900 mb-2">Selamat Datang di WhatsApp</h3>
                        <p className="text-gray-500 max-w-sm leading-relaxed">
                            Kirim dan terima pesan tanpa perlu menautkan telepon agar tetap online.
                        </p>
                        <div className="mt-8 flex gap-4 text-xs text-gray-400 font-medium tracking-wide uppercase">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Online</span>
                        </div>
                    </div>
                )}

                {/* Save Contact Modal */}
                {
                    isSaveContactModalOpen && (
                        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                                {/* Header */}
                                <div className="bg-navy-900 px-6 py-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="flex items-center justify-between relative z-10">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <UserPlus className="w-5 h-5 text-primary-400" />
                                            Simpan Kontak
                                        </h3>
                                        <button
                                            onClick={() => setIsSaveContactModalOpen(false)}
                                            className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-6 space-y-5">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Nomor Telepon</label>
                                        <input
                                            type="text"
                                            value={saveContactPhone}
                                            onChange={e => setSaveContactPhone(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                            placeholder="+62..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Nama Lengkap</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={saveContactName}
                                            onChange={(e) => setSaveContactName(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder-gray-300"
                                            placeholder="Masukkan nama kontak..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveContactConfirm();
                                            }}
                                        />
                                    </div>

                                    {/* TAGS INPUT */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Tags (Opsional)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={saveContactTagInput}
                                                onChange={(e) => setSaveContactTagInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (saveContactTagInput.trim() && !saveContactTags.includes(saveContactTagInput.trim())) {
                                                            setSaveContactTags([...saveContactTags, saveContactTagInput.trim()]);
                                                            setSaveContactTagInput('');
                                                        }
                                                    }
                                                }}
                                                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder-gray-300"
                                                placeholder="Ketik tag & enter..."
                                            />
                                            <button
                                                onClick={() => {
                                                    if (saveContactTagInput.trim() && !saveContactTags.includes(saveContactTagInput.trim())) {
                                                        setSaveContactTags([...saveContactTags, saveContactTagInput.trim()]);
                                                        setSaveContactTagInput('');
                                                    }
                                                }}
                                                disabled={!saveContactTagInput.trim()}
                                                className="px-4 py-3 bg-primary-50 text-primary-600 rounded-xl font-bold hover:bg-primary-100 transition-colors disabled:opacity-50"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Quick Selection */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {['Royal', 'Gold', 'Platinum', 'VIP'].map(tag => (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        if (!saveContactTags.includes(tag)) {
                                                            setSaveContactTags([...saveContactTags, tag]);
                                                        }
                                                    }}
                                                    disabled={saveContactTags.includes(tag)}
                                                    className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg border transition-all 
                                                    ${tag === 'Royal' ? 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100' :
                                                            tag === 'Gold' ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' :
                                                                tag === 'Platinum' ? 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100' :
                                                                    'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}
                                                    ${saveContactTags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Active Tags */}
                                        {saveContactTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                {saveContactTags.map((tag, idx) => (
                                                    <span key={idx} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shadow-sm">
                                                        {tag}
                                                        <button
                                                            onClick={() => setSaveContactTags(saveContactTags.filter(t => t !== tag))}
                                                            className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <button
                                            onClick={() => setIsSaveContactModalOpen(false)}
                                            className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={handleSaveContactConfirm}
                                            disabled={!saveContactName.trim()}
                                            className="flex-1 py-2.5 bg-navy-900 text-white rounded-xl font-bold hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            Simpan
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Delete Chat Modal */}
                {/* LIGHTBOX MODAL */}
                {
                    selectedImage && (
                        <div
                            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                            onClick={() => setSelectedImage(null)}
                        >
                            <div className="relative max-w-full max-h-full">
                                <button
                                    className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors p-2"
                                    onClick={() => setSelectedImage(null)}
                                >
                                    <X size={32} />
                                </button>
                                <img
                                    src={selectedImage}
                                    alt="Full Preview"
                                    className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                                />
                            </div>
                        </div>
                    )
                }

                <DeleteConfirm
                    open={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={confirmDeleteChat}
                    title="Hapus Percakapan"
                    message={`Yakin ingin menghapus riwayat chat dengan ${selectedChat?.displayName || 'Unknown Contact'}? Pesan akan hilang permanen dan tidak dapat dipulihkan.`}
                    isLoading={isDeletingChat}
                />
                {/* NEW CHAT MODAL */}
                {
                    isNewChatModalOpen && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-primary-500" />
                                        Mulai Chat Baru
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Telepon</label>
                                            <input
                                                type="tel"
                                                placeholder="Contoh: 08123456789"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                                                value={newChatPhone}
                                                onChange={e => setNewChatPhone(e.target.value)}
                                                autoFocus
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Masukkan nomor WhatsApp tujuan</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kontak (Opsional)</label>
                                            <input
                                                type="text"
                                                placeholder="Nama Pelanggan (Contoh: Irgi)"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                                                value={newChatName}
                                                onChange={e => setNewChatName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleStartNewChat();
                                                }}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Jika diisi, akan otomatis disimpan sebagai customer.</p>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setIsNewChatModalOpen(false)}
                                                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                onClick={handleStartNewChat}
                                                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 font-bold transition-colors shadow-lg shadow-primary-500/30"
                                            >
                                                Mulai Chat
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                <TagManagementModal
                    isOpen={isTagModalOpen}
                    onClose={() => setIsTagModalOpen(false)}
                    customerId={getCustomerIdForChat(selectedChat)}
                    currentTags={getTagsForChat(selectedChat)}
                />
            </div>
        </div>
    );
};


