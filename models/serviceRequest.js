// models/serviceRequest.js
import pool from "../config/db.js";

export const createServiceRequest = async (data) => {
  const { category, description, location, priority, citizen_id, attachments } = data;
  const reference_number = `JAB-SR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const result = await pool.query(
    `INSERT INTO service_requests
    (reference_number, category, description, location, priority, citizen_id, attachments, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted',NOW())
    RETURNING *`,
    [reference_number, category, description, location, priority, citizen_id, attachments]
  );

  return result.rows[0];
};

export const getServiceRequestsByCitizen = async (citizen_id) => {
  const result = await pool.query(
    `SELECT * FROM service_requests WHERE citizen_id=$1 ORDER BY created_at DESC`,
    [citizen_id]
  );
  return result.rows;
};