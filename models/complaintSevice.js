import pool from './db'; // your PostgreSQL pool

export const createComplaint = async (complaint, citizenId = null) => {
  const {
    category,
    subCategory,
    priority,
    description,
    location,
    isAnonymous,
    status = 'submitted',
  } = complaint;

  // generate reference number
  const timestamp = Date.now();
  const referenceNumber = `JAB-CMP-${new Date().getFullYear()}-${timestamp.toString().slice(-5)}`;

  const query = `
    INSERT INTO complaints
    (reference_number, category, sub_category, priority, description, location, is_anonymous, citizen_id, status)
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `;

  const values = [
    referenceNumber,
    category,
    subCategory || null,
    priority,
    description,
    location || null,
    isAnonymous,
    isAnonymous ? citizenId : null,
    status
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};