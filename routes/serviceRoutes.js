import express from "express";
import pool from "../config/db.js";
import multer from "multer";
import crypto from "crypto";
import { verifyToken } from "../middleware/authMiddleware.js"; // your JWT middleware

const router = express.Router();

// Multer setup for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    cb(null, Date.now() + "-" + crypto.randomBytes(4).toString("hex") + "." + ext);
  },
});
const upload = multer({ storage });

// Helper: generate reference number
function generateReferenceNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000); // 6-digit
  return `JAB-SR-${year}-${random}`;
}

// CREATE SERVICE REQUEST
router.post("/", verifyToken, upload.array("attachments", 5), async (req, res) => {
  const { category, description, priority, location, status } = req.body;
  const attachments = req.files ? req.files.map((f) => f.filename) : [];

  // Required fields
  if (!category || !description || !priority || !location) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO service_requests 
       (reference_number, citizen_id, category, description, priority, location, attachments, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        generateReferenceNumber(),
        req.user.id, // extracted from JWT
        category,
        description,
        priority,
        location,
        attachments,
        status || "submitted",
      ]
    );

    res.status(201).json({
      message: "Service request submitted successfully",
      referenceNumber: result.rows[0].reference_number,
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Submission failed" });
  }
});

// GET SERVICE BY REFERENCE NUMBER
router.get("/:referenceNumber", async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const result = await pool.query(
      "",
      [referenceNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({
      type: "service",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching request" });
  }
});

router.get("/", (req, res) => {
  res.json({ services: ["Service1", "Service2"] });
});

export default router;