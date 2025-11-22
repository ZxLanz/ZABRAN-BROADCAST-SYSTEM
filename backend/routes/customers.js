import express from "express";
import Customer from "../models/Customer.js";

const router = express.Router();

// GET ALL
router.get("/", async (req, res) => {
  const data = await Customer.find().sort({ createdAt: -1 });
  res.json({ success: true, data });
});

// ADD CUSTOMER
router.post("/", async (req, res) => {
  try {
    const cust = await Customer.create(req.body);
    res.json({ success: true, data: cust });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE CUSTOMER
router.delete("/:id", async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
