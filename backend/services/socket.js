const socketIo = require('socket.io');

let io;

const initSocket = (server, corsOptions) => {
    io = socketIo(server, {
        cors: corsOptions,
        pingTimeout: 60000,
    });

    io.on('connection', (socket) => {
        console.log('🔌 [SOCKET] Client connected:', socket.id);

        // ✅ AUTO-JOIN: Join user to their room based on userId query
        const userId = socket.handshake.query.userId;
        if (userId) {
            socket.join(userId);
            console.log(`🔌 [SOCKET] Auto-joined room: ${userId}`);
        } else {
            console.warn('⚠️ [SOCKET] Client connected without userId in query');
        }

        // Manual join room (for additional rooms if needed)
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`🔌 [SOCKET] Client manually joined room: ${room}`);
        });

        // ✅ PING TEST LISTENER
        socket.on('ping_test', (data) => {
            console.log('🏓 [SOCKET PING] Received ping from client:', data);
            socket.emit('pong_test', { message: 'Pong from server!', original: data });
        });

        socket.on('disconnect', () => {
            console.log('🔌 [SOCKET] Client disconnected:', socket.id);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIO };
