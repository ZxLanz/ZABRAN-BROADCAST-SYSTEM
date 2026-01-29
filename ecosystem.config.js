module.exports = {
    apps: [
        {
            name: "zabran-backend",
            script: "backend/server.js",
            instances: 1,
            autorestart: true,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                PORT: 5000,
                MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/zabran_broadcast",
                PM2_NO_PMX: "1" // 🛑 DISABLE PMX to fix wmic error
            },
            watch: false,
            time: true, // ✅ Add Timestamps to Logs
            log_date_format: "YYYY-MM-DD HH:mm:ss"
        },
        {
            name: "zabran-n8n",
            script: "n8n.cmd",
            args: "start",
            interpreter: "none",
            env: {
                N8N_PORT: 5678,
            },
            time: true, // ✅ Add Timestamps to Logs
            log_date_format: "YYYY-MM-DD HH:mm:ss"
        }
    ]
};
