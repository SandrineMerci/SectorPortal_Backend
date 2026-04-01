import express from "express";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import twilio from "twilio";



dotenv.config();
const router = express.Router();
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);


//////////////////////////////////////////////////
// PHONE NORMALIZER
//////////////////////////////////////////////////
function normalizePhone(phone) {
  let digits = phone.replace(/\D/g, ""); // remove non-digits
  if (digits.startsWith("0")) {
    digits = "+250" + digits.slice(1); // add country code
  } else if (!digits.startsWith("+")) {
    digits = "+250" + digits; // fallback if no + sign
  }
  return digits;
}

//////////////////////////////////////////////////
// MULTER (AVATAR)
//////////////////////////////////////////////////
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    cb(null, Date.now() + "." + ext);
  },
});
const upload = multer({ storage });

//////////////////////////////////////////////////
// EMAIL CONFIG (GMAIL TEST)
//////////////////////////////////////////////////
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

//////////////////////////////////////////////////
// GENERATE OTP
//////////////////////////////////////////////////

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

//////////////////////////////////////////////////
// REGISTER
//////////////////////////////////////////////////
router.post("/register", upload.single("avatar"), async (req, res) => {
  let { name, email, phone, nationalId, password } = req.body;
  const avatar = req.file ? req.file.filename : null;

  //  CLEAN NATIONAL ID
  nationalId = nationalId.replace(/\D/g, "");

  //  VALIDATE LENGTH
  if (nationalId.length !== 16) {
    return res.status(400).json({
      message: "National ID must be exactly 16 digits",
    });
  }

  phone = normalizePhone(phone);

  if (!phone || phone.length < 10 || phone.length > 15) {
    return res.status(400).json({
      message: "Invalid phone number",
    });
  }

  try {
    // Check duplicates
    const existing = await pool.query(
      "SELECT * FROM users WHERE email=$1 OR phone=$2 OR national_id=$3",
      [email, phone, nationalId]
    );

    if (existing.rowCount > 0) {
      return res.status(400).json({
        message: "Email, phone, or National ID already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = generateOTP();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users
      (name, email, phone, national_id, password, otp_hash, otp_expiry, avatar)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [name, email, phone, nationalId, hashedPassword, otpHash, otpExpiry, avatar]
    );

    // SEND OTP: first email, then phone if email not provided
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is ${otp}`,
      });
      console.log("OTP sent via email:", otp);
    } else if (phone) {
      // Make sure your phone number is in +250XXXXXXXX format
      await client.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
      console.log("OTP sent via SMS:", otp);
    } else {
      return res.status(400).json({
        message: "No email or phone provided to send OTP",
      });
    }

    res.status(201).json({
      message: "OTP sent. Please verify.",
      userId: result.rows[0].id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

//////////////////////////////////////////////////
// VERIFY OTP
//////////////////////////////////////////////////
router.post("/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  try {
    const result = await pool.query(
      `SELECT * FROM users
       WHERE id=$1 AND otp_hash=$2 AND otp_expiry > NOW()`,
      [userId, hashedOtp]
    );

    if (!result.rowCount) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    await pool.query(
      `UPDATE users
       SET is_verified=true, otp_hash=NULL, otp_expiry=NULL
       WHERE id=$1`,
      [userId]
    );

    res.json({ message: "Account verified successfully" });

  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

//////////////////////////////////////////////////
// LOGIN (JWT)
//////////////////////////////////////////////////
router.post("/login", async (req, res) => {
  let { identifier, password } = req.body;

  // ✅ validate input FIRST
  if (!identifier || !password) {
    return res.status(400).json({
      message: "Identifier and password are required",
    });
  }

  try {
    let result;
    let table = "users"; // default table
    let value;

    // Prepare phone variants if input is a phone
    const normalizedPhone = normalizePhone(identifier); // +250788123456
    const localPhone = normalizedPhone.replace("+250", "0"); // 0788123456

    // Check users table first
    if (identifier.includes("@")) {
      value = identifier.toLowerCase();
      result = await pool.query("SELECT * FROM users WHERE email=$1", [value]);
    } else {
      // Query both +250 and 0... variants
      result = await pool.query(
        "SELECT * FROM users WHERE phone=$1 OR phone=$2",
        [normalizedPhone, localPhone]
      );
    }

    // If not found in users, check staff table
    if (!result.rowCount) {
      table = "staff";

      if (identifier.includes("@")) {
        value = identifier.toLowerCase();
        result = await pool.query("SELECT * FROM staff WHERE email=$1", [value]);
      } else {
        result = await pool.query(
          "SELECT * FROM staff WHERE phone=$1 OR phone=$2",
          [normalizedPhone, localPhone]
        );
      }
    }

    if (!result.rowCount) return res.status(400).json({ message: "User not found" });

    const user = result.rows[0];

    // Citizens require verification
    if (table === "users" && !user.is_verified)
      return res.status(400).json({ message: "Account not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const role = table === "users" ? "citizen" : user.role.toLowerCase();

    const token = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar || null,
        role,
        department: table === "staff" ? user.department : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;