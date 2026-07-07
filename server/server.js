const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Task = require("./models/Task");
const sendEmail = require("./utils/sendEmail");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// MONGODB CONNECTION WITH RETRY LOGIC
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskmanager";

const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

let retryCount = 0;
const MAX_RETRIES = 5;

async function connectWithRetry() {
  try {
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    retryCount = 0;
    console.log(`✅ Connected to MongoDB: ${MONGODB_URI}`);
  } catch (err) {
    retryCount++;
    const delay = Math.min(5000 * retryCount, 30000);
    console.error(`❌ MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}):`, err.message);
    if (retryCount === 1) {
      console.error("\n🔍 Troubleshooting tips:");
      console.error("  1. Make sure MongoDB is running: `mongod`");
      console.error("  2. Check MONGODB_URI in .env:", MONGODB_URI);
      console.error("  3. For Atlas: whitelist your IP at cloud.mongodb.com\n");
    }
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      setTimeout(connectWithRetry, delay);
    } else {
      console.error("🚫 Max retries reached. Exiting.");
      process.exit(1);
    }
  }
}

connectWithRetry();

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected. Reconnecting...");
  connectWithRetry();
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

// ==========================================
// JWT MIDDLEWARE
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || "secure_task_manager_secret_token_key_13579";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No session token provided. Authorization denied." });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid session token. Access forbidden." });
    req.user = user;
    next();
  });
};

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
  const dbState = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({ status: "ok", db: dbState[mongoose.connection.readyState] || "unknown", uptime: process.uptime() });
});

// ==========================================
// AUTH ENDPOINTS
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName)
      return res.status(400).json({ message: "Please fill in all registration fields." });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "An account with this email already exists." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ email, password: hashedPassword, firstName, lastName });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Please enter your email and password." });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "No account found with this email." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password credentials." });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ==========================================
// TASKS ENDPOINTS
// ==========================================

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error("Fetch Tasks Error:", err);
    res.status(500).json({ message: "Server failed to fetch tasks." });
  }
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const { title, desc, priority, status } = req.body;
    if (!title) return res.status(400).json({ message: "Task title is required." });
    const task = new Task({ title, desc, priority: priority || "medium", status: status || "todo", userId: req.user.userId });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error("Create Task Error:", err);
    res.status(500).json({ message: "Server failed to save task." });
  }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const { title, desc, priority, status } = req.body;
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!task) return res.status(404).json({ message: "Task not found or authorization denied." });
    if (title !== undefined) task.title = title;
    if (desc !== undefined) task.desc = desc;
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    await task.save();
    res.json(task);
  } catch (err) {
    console.error("Update Task Error:", err);
    res.status(500).json({ message: "Server failed to update task." });
  }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!task) return res.status(404).json({ message: "Task not found or authorization denied." });
    res.json({ message: "Task successfully deleted." });
  } catch (err) {
    console.error("Delete Task Error:", err);
    res.status(500).json({ message: "Server failed to delete task." });
  }
});

// ==========================================
// PASSWORD RESET
// ==========================================

app.post("/api/auth/reset-request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });

    // Reload .env fresh on every request
    require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

    // Debug: confirm env vars are loaded
    console.log("[DEBUG] GMAIL_USER:", process.env.GMAIL_USER || "MISSING ❌");
    console.log("[DEBUG] GMAIL_APP_PASS:", process.env.GMAIL_APP_PASS && process.env.GMAIL_APP_PASS !== "your_16_char_app_password_here" ? "SET ✅" : "MISSING ❌");

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: "No account found with this email." });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    user.resetCode = code;
    user.resetCodeExpires = expires;
    await user.save();

    let sentInfo = "";
    let emailSent = false;

    const otpHtml = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
        <h2>Password Reset OTP</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing:8px;color:#4F46E5;">${code}</h1>
        <p>Valid for <strong>15 minutes</strong>. If you didn't request this, ignore this email.</p>
      </div>`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your OTP Verification Code",
        html: otpHtml,
      });
      emailSent = true;
      sentInfo = "Verification email sent via Gmail.";
    } catch (err) {
      console.error("[Gmail SMTP] ❌ Failed to send reset email:", err.message);
      sentInfo = "Email delivery failed. Check GMAIL_USER and GMAIL_APP_PASS in .env";
    }

    console.log("\n==================================================");
    console.log(`[PASSWORD RESET OTP]`);
    console.log(`Email   : ${user.email}`);
    console.log(`Code    : ${code}`);
    console.log(`Expires : ${expires.toLocaleTimeString()}`);
    console.log("==================================================\n");

    res.json({ message: `A verification code has been generated. ${sentInfo}` });
  } catch (err) {
    console.error("Reset Request Error:", err);
    res.status(500).json({ message: "Server error during reset request." });
  }
});

app.post("/api/auth/reset-confirm", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: "Please fill in all fields." });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: "No account found with this email." });

    if (!user.resetCode || user.resetCode !== code.trim())
      return res.status(400).json({ message: "Invalid verification code." });

    if (!user.resetCodeExpires || new Date() > user.resetCodeExpires)
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetCode = null;
    user.resetCodeExpires = null;
    await user.save();

    res.json({ message: "Password reset successfully! You can now sign in." });
  } catch (err) {
    console.error("Reset Confirm Error:", err);
    res.status(500).json({ message: "Server error during password reset." });
  }
});

// ==========================================
// AI COPILOT PROXY
// ==========================================
app.post("/api/copilot", authenticateToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required." });

    require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    if (!apiKey) return res.status(500).json({ message: "Gemini API Key is not configured on the server." });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({ message: data.error?.message || `Gemini API returned status ${response.status}`, error: data.error || data });
    }

    res.json(data);
  } catch (err) {
    console.error("Copilot Proxy Error:", err);
    res.status(500).json({ message: "Server error calling Gemini API." });
  }
});

// ==========================================
// PORT BINDING
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Task Manager Server running on port ${PORT}`);
});