import pool from "./config/db.js"; // your db config
import bcrypt from "bcryptjs";

async function hashStaffPasswords() {
  try {
    // 1. Get all staff records
    const res = await pool.query("SELECT id, password FROM staff");
    const staffList = res.rows;

    for (const staff of staffList) {
      // 2. Hash current password
      const hashed = await bcrypt.hash(staff.password, 10);

      // 3. Update the staff row with hashed password
      await pool.query("UPDATE staff SET password=$1 WHERE id=$2", [
        hashed,
        staff.id,
      ]);
      console.log(`Hashed password for staff id: ${staff.id}`);
    }

    console.log("All staff passwords hashed successfully.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

hashStaffPasswords();