import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    let services;
    let complaints;

    if (req.user.role === "executive") {
  // 🧑‍💼 EXECUTIVE → ALL DATA
  services = await pool.query(`
    SELECT s.*, 
           u.name AS citizen_name,
            u.email,
       u.phone,
           st.name AS staff_name,
           st.department AS staff_department
    FROM service_requests s
    LEFT JOIN users u ON s.citizen_id = u.id
    LEFT JOIN staff st ON s.assigned_to = st.id
    ORDER BY s.created_at DESC
  `);

  complaints = await pool.query(`
    SELECT c.*, 
           u.name AS citizen_name,
            u.email,
       u.phone,
           st.name AS staff_name,
           st.department AS staff_department
    FROM complaints c
    LEFT JOIN users u ON c.citizen_id = u.id
    LEFT JOIN staff st ON c.assigned_to = st.id
    ORDER BY c.created_at DESC
  `);

} else if (req.user.role.toLowerCase().includes("officer")) {
  // 👮 OFFICER → ONLY ASSIGNED CASES
  services = await pool.query(
    `SELECT s.*, 
            u.name AS citizen_name,
              u.email,
       u.phone,
            st.name AS staff_name,
            st.department AS staff_department
     FROM service_requests s
     LEFT JOIN users u ON s.citizen_id = u.id
     LEFT JOIN staff st ON s.assigned_to = st.id
     WHERE s.assigned_to = $1
     ORDER BY s.created_at DESC`,
    [req.user.id]
  );

  complaints = await pool.query(
    `SELECT c.*, 
            u.name AS citizen_name,
              u.email,
       u.phone,
            st.name AS staff_name,
            st.department AS staff_department
     FROM complaints c
     LEFT JOIN users u ON c.citizen_id = u.id
     LEFT JOIN staff st ON c.assigned_to = st.id
     WHERE c.assigned_to = $1
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );

} else {
  // 👤 CITIZEN → ONLY THEIR DATA
  services = await pool.query(
    `SELECT s.*, 
            u.name AS citizen_name,
             u.email,
       u.phone,
            st.name AS staff_name,
            st.department AS staff_department
     FROM service_requests s
     LEFT JOIN users u ON s.citizen_id = u.id
     LEFT JOIN staff st ON s.assigned_to = st.id
     WHERE s.citizen_id = $1
     ORDER BY s.created_at DESC`,
    [req.user.id]
  );

  complaints = await pool.query(
    `SELECT c.*, 
            u.name AS citizen_name,
             u.email,
       u.phone,
            st.name AS staff_name,
            st.department AS staff_department
     FROM complaints c
     LEFT JOIN users u ON c.citizen_id = u.id
     LEFT JOIN staff st ON c.assigned_to = st.id
     WHERE c.citizen_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
}

    // 🎯 FORMAT RESPONSE (IMPORTANT)
res.json({
  services: services.rows.map((row) => ({
    ...row,
    citizen: row.citizen_name || "Anonymous",
    citizenEmail: row.email || null,
    citizenPhone: row.phone || null,
    assignedTo: row.staff_name || null,
    department: row.staff_department || null,
  })),
  complaints: complaints.rows.map((row) => ({
    ...row,
    citizen: row.citizen_name || "Anonymous",
    citizenEmail: row.email || null,
    citizenPhone: row.phone || null,
    assignedTo: row.staff_name || null,
    department: row.staff_department || null,
  })),
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

router.get('/cases/:ref', async (req, res) => {
  try {
    const ref = req.params.ref;

    // ✅ SERVICE REQUEST
    const service = await pool.query(
      `SELECT s.*, 
              u.name AS citizen_name, u.email, u.phone,
              st.id AS staff_id, st.name AS staff_name, st.department AS staff_department
       FROM service_requests s
       LEFT JOIN users u ON s.citizen_id = u.id
       LEFT JOIN staff st ON s.assigned_to = st.id
       WHERE s.reference_number = $1`,
      [ref]
    );

    if (service.rows.length > 0) {
      const row = service.rows[0];

      return res.json({
        ...row,
        type: "service",

        // 👤 Citizen
        user: row.citizen_id
          ? {
              name: row.citizen_name,
              email: row.email,
              phone: row.phone,
            }
          : null,

        // 👨‍💼 Assigned Staff
        assignedTo: row.staff_id
          ? {
              id: row.staff_id,
              name: row.staff_name,
              department: row.staff_department,
            }
          : null,
      });
    }

    // ✅ COMPLAINT
    const complaint = await pool.query(
      `SELECT c.*, 
              u.name AS citizen_name, u.email, u.phone,
              st.id AS staff_id, st.name AS staff_name, st.department AS staff_department
       FROM complaints c
       LEFT JOIN users u ON c.citizen_id = u.id
       LEFT JOIN staff st ON c.assigned_to = st.id
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
              name: row.citizen_name,
              email: row.email,
              phone: row.phone,
            }
          : null,

        assignedTo: row.staff_id
          ? {
              id: row.staff_id,
              name: row.staff_name,
              department: row.staff_department,
            }
          : null,
      });
    }

    return res.status(404).json({ message: "Case not found" });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/cases/:id/assign", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, type } = req.body;

    if (!staffId || !type) {
      return res.status(400).json({ message: "Missing staffId or type" });
    }

    let updatedCase;

    if (type === "complaint") {
      const result = await pool.query(
        `UPDATE complaints 
         SET assigned_to=$1, status='under_review' 
         WHERE reference_number=$2 
         RETURNING *`,
        [staffId, id]
      );
      updatedCase = result.rows[0];
    } else {
      const result = await pool.query(
        `UPDATE service_requests 
         SET assigned_to=$1, status='under_review' 
         WHERE reference_number=$2 
         RETURNING *`,
        [staffId, id]
      );
      updatedCase = result.rows[0];
    }

    if (!updatedCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    // ✅ Send response with id matching frontend and assignedTo field
    res.json({
      ...updatedCase,
      id: updatedCase.reference_number,  // match frontend 'c.id'
      assignedTo: updatedCase.assigned_to, // keep as assignedTo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error assigning case" });
  }
});

router.patch("/cases/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, type } = req.body;

    if (!status || !type) {
      return res.status(400).json({ message: "Missing status or type" });
    }

    let result;

    if (type === "complaint") {
      result = await pool.query(
        `UPDATE complaints 
         SET status = $1, updated_at = NOW()
         WHERE reference_number = $2
         RETURNING *`,
        [status, id]
      );
    } else {
      result = await pool.query(
        `UPDATE service_requests 
         SET status = $1, updated_at = NOW()
         WHERE reference_number = $2
         RETURNING *`,
        [status, id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

export default router;