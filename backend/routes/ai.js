import express from "express";
import { generateAIMessage } from "../services/aiService.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/generate", authMiddleware, async (req, res) => {
  try {
    const { message, tone } = req.body;

    const result = await generateAIMessage(message, tone);

    res.json({ result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
