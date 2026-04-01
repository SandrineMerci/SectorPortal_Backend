import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    let services;
    let complaints;

    // 👇 CHECK ROLE
    if (req.user.role === "executive") {
      // 🧑‍💼 EXECUTIVE → GET ALL DATA
      services = await pool.query(
        "SELECT * FROM service_requests ORDER BY created_at DESC"
      );

      complaints = await pool.query(
        "SELECT * FROM complaints ORDER BY created_at DESC"
      );
    } else {
      // 👤 CITIZEN → ONLY THEIR DATA
      services = await pool.query(
        "SELECT * FROM service_requests WHERE citizen_id = $1 ORDER BY created_at DESC",
        [req.user.id]
      );

      complaints = await pool.query(
        "SELECT * FROM complaints WHERE citizen_id = $1 ORDER BY created_at DESC",
        [req.user.id]
      );
    }

    res.json({
      services: services.rows,
      complaints: complaints.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

router.get('/cases/:ref', async (req, res) => {
  try {
    const ref = req.params.ref;

    // ✅ SERVICE
    const service = await pool.query(
      `SELECT s.*, u.name, u.email, u.phone
       FROM service_requests s
       LEFT JOIN users u ON s.citizen_id = u.id
       WHERE s.reference_number = $1`,
      [ref]
    );

    if (service.rows.length > 0) {
      const row = service.rows[0];

      return res.json({
        ...row,
        type: "service",
        user: row.citizen_id
          ? {
              name: row.name,
              email: row.email,
              phone: row.phone,
            }
          : null, // 👈 anonymous
      });
    }

    // ✅ COMPLAINT
    const complaint = await pool.query(
      `SELECT c.*, u.name, u.email, u.phone
       FROM complaints c
       LEFT JOIN users u ON c.citizen_id = u.id
       WHERE c.reference_number = $1`,
      [ref]
    );

    if (complaint.rows.length > 0) {
      const row = complaint.rows[0];

      return res.json({
        ...row,
        type: "complaint",
        user: row.citizen_id
          ? {
              name: row.name,
              email: row.email,
              phone: row.phone,
            }
          : null, // 👈 anonymous
      });
    }

    return res.status(404).json({ message: "Case not found" });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;