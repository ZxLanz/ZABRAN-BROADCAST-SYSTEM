const socketIo = require('socket.io');

let io;

const initSocket = (server, corsOptions) => {
    io = socketIo(server, {
        cors: corsOptions,
        pingTimeout: 60000,
    });

    io.on('connection', (socket) => {
        console.log('🔌 [SOCKET] Client connected:', socket.id);

        // Join room based on user ID logic later if needed
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`🔌 [SOCKET] Client joined room: ${room}`);
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
