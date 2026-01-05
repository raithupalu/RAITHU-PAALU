require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint for mobile/monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// --- DATABASE CONNECTION ---
const db_connection_string = process.env.MONGO_URI || "mongodb+srv://raithupalu_db_user:Raithu123@raithu.gcctfct.mongodb.net/raithupaalu?appName=raithu";

let isDBConnected = false;

const connectDB = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    await mongoose.connect(db_connection_string, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isDBConnected = true;
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    isDBConnected = false;
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Middleware to check DB connection
const checkDB = (req, res, next) => {
  if (!isDBConnected) {
    return res.status(503).json({ error: "Database not ready" });
  }
  next();
};

// --- MODELS ---
const saleSchema = new mongoose.Schema({
  date: String,
  twoL: { type: Number, default: 0 },
  oneL: { type: Number, default: 0 },
  threeQuarterL: { type: Number, default: 0 },
  halfL: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  sales: [saleSchema],
  lastActive: { type: Number, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  id: String,
  username: String,
  quantity: String,
  status: String,
  timestamp: Date
});

const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

// --- ROUTES ---

// Serve Frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Update user activity
app.post('/update-activity', checkDB, async (req, res) => {
  try {
    const { username, lastActive } = req.body;
    await User.updateOne({ username }, { lastActive });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error updating activity" });
  }
});

// Delete user
app.post('/delete-user', checkDB, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.json({ success: false, error: 'Username missing' });
    }
    const result = await User.deleteOne({ username });
    if (result.deletedCount === 0) {
      return res.json({ success: false, error: 'User not found' });
    }
    await Order.deleteMany({ username });
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

// Register
app.post("/register", checkDB, async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: "User exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, sales: [] });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "Error registering user" });
  }
});

// Login
app.post("/login", checkDB, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin123") {
      return res.json({ role: "admin" });
    }
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json(null);
    }
    // Update last active
    user.lastActive = Date.now();
    await user.save();
    res.json({ username: user.username, role: "user" });
  } catch (e) {
    res.status(500).json({ error: "Login error" });
  }
});

// Get User Data
app.get("/user/:username", checkDB, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "Error fetching user" });
  }
});

// Change Password
app.post("/change-password", checkDB, async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect old password" });
    const hashedNew = await bcrypt.hash(newPassword, 10);
    user.password = hashedNew;
    await user.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error changing password" });
  }
});

// Add Sale
app.post("/add-sale", checkDB, async (req, res) => {
  try {
    const { username, sale } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    const existing = user.sales.find(s => s.date === sale.date);
    if (existing) {
      existing.twoL = sale.twoL;
      existing.oneL = sale.oneL;
      existing.threeQuarterL = sale.threeQuarterL;
      existing.halfL = sale.halfL;
    } else {
      user.sales.push(sale);
    }
    await user.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error adding sale" });
  }
});

// Delete Sale
app.post("/delete-sale", checkDB, async (req, res) => {
  try {
    const { username, date } = req.body;
    await User.updateOne({ username }, { $pull: { sales: { date } } });
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: "Error deleting sale" }); 
  }
});

// Admin: Get All Users
app.get("/users", checkDB, async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: "Error fetching users" });
  }
});

// Place Order
app.post("/place-order", checkDB, async (req, res) => {
  try {
    await Order.create({ ...req.body, id: Date.now().toString(), status: "Pending", timestamp: new Date() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error placing order" });
  }
});

// Get All Orders
app.get("/orders", checkDB, async (req, res) => { 
  try {
    const orders = await Order.find().sort({ timestamp: -1 }).lean();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: "Error fetching orders" });
  }
});

// Get User Orders
app.get("/orders/:username", checkDB, async (req, res) => { 
  try {
    const orders = await Order.find({ username: req.params.username }).sort({ timestamp: -1 }).lean();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: "Error fetching user orders" });
  }
});

// Update Order Status
app.post("/update-order", checkDB, async (req, res) => {
  try {
    const { id, status } = req.body;
    await Order.findOneAndUpdate({ id }, { status });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Error updating order" });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});