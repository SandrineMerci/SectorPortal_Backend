// routes/staffRoutes.js
import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // JWT middleware

const router = express.Router();

// GET /staff/team
// Returns all staff with role 'SECTOR OFFICER' (or OFFICER)
router.get("/team", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        role,
        email,
        phone,
        department
      FROM staff
      WHERE UPPER(role) LIKE '%OFFICER%'
      ORDER BY name;
    `;

    const result = await pool.query(query);

    // Add dummy stats for now
    const staffTeam = result.rows.map(member => ({
      ...member,
      activeCases: 0,
      resolvedThisMonth: 0,
      status: "available", // default, can be updated later
    }));

    res.json(staffTeam);
  } catch (err) {
    console.error("Error fetching staff team:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;