import express from "express";
import Template from "../models/Template.js";

const router = express.Router();

// GET ALL
router.get("/", async (req, res) => {
  const data = await Template.find();
  res.json({ success: true, data });
});

// CREATE TEMPLATE
router.post("/", async (req, res) => {
  try {
    const tpl = await Template.create(req.body);
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
