import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/services", serviceRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/staff", staffRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
