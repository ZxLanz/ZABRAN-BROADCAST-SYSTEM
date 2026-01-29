
const io = require('socket.io-client');
const axios = require('axios');

async function check() {
    console.log('--- SYSTEM HEALTH CHECK ---');
    try {
        // 1. Check API
        const res = await axios.get('http://localhost:5000/');
        console.log('✅ API Status:', res.data);

        // 2. Check Socket
        const socket = io('http://localhost:5000');
        socket.on('connect', () => {
            console.log('✅ Socket Connected! ID:', socket.id);
            socket.disconnect();
            process.exit(0);
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket Error:', err.message);
            process.exit(1);
        });

    } catch (err) {
        console.error('❌ API Error:', err.message);
        process.exit(1);
    }
}

check();
