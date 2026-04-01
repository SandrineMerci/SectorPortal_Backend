// routes/complaintRoutes.js
import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Generate reference number
function generateReferenceNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `JAB-CMP-${year}-${random}`;
}

// CREATE COMPLAINT
router.post("/", verifyToken, async (req, res) => {
  const { category, description, priority, location, status, isAnonymous } = req.body;

  // Validate required fields
  if (!category || !description || !priority) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  try {
   const citizen_id = isAnonymous ? null : req.user.id;

    const result = await pool.query(
      `INSERT INTO complaints 
       (reference_number, citizen_id, category, description, priority, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        generateReferenceNumber(),
        citizen_id,
        category,
        description,
        priority,
        location,
        status || "submitted",
      ]
    );

    res.status(201).json({
      message: "Complaint submitted successfully",
      referenceNumber: result.rows[0].reference_number,
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Submission failed" });
  }
});

// GET COMPLAINT BY REFERENCE NUMBER
router.get("/:referenceNumber", async (req, res) => {
  const { referenceNumber } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM complaints WHERE reference_number = $1",
      [referenceNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({
      type: "complaint",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching complaint" });
  }
});

router.get("/", (req, res) => {
  res.json({ complaints: ["Complaint1", "Complaint2"] });
});


export default router;