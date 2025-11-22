import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";

import authRoutes from "./routes/auth.js";

dotenv.config();
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// DATABASE
connectDB();

// ROUTES
app.use("/api/auth", authRoutes);

// ROOT TEST
app.get("/", (req, res) => {
    res.send("Zabran API Running...");
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
