import { io } from 'socket.io-client';

let socket;

export const initSocket = (token) => {
    if (socket) return socket;

    const SOCKET_URL = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace('/api', '')
        : 'http://localhost:5000';

    console.log('🔌 Connecting to Socket.IO at:', SOCKET_URL);

    socket = io(SOCKET_URL, {
        auth: {
            token: token
        },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('✅ [SOCKET] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.error('❌ [SOCKET] Connection Error:', err.message);
    });

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        // Attempt to init if token exists in localStorage, otherwise return null
        const token = localStorage.getItem('token');
        if (token) {
            return initSocket(token);
        }
        return null;
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('🔌 [SOCKET] Disconnected');
    }
};
