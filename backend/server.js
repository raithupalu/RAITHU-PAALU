require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();

// --- MIDDLEWARE ---
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: Date.now(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// --- DATABASE CONNECTION ---
const db_connection_string = process.env.MONGO_URI || "mongodb+srv://raithupalu_db_user:Raithu123@raithu.gcctfct.mongodb.net/raithupaalu?retryWrites=true&w=majority&appName=raithu";

let isDBConnected = false;

const connectDB = async () => {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    await mongoose.connect(db_connection_string, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2
    });
    isDBConnected = true;
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    isDBConnected = false;
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
  isDBConnected = false;
  connectDB();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
  isDBConnected = false;
});

connectDB();

// Middleware to check DB connection
const checkDB = (req, res, next) => {
  if (!isDBConnected || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
  }
  next();
};

// --- MODELS ---
const saleSchema = new mongoose.Schema({
  date: { type: String, required: true },
  twoL: { type: Number, default: 0 },
  oneL: { type: Number, default: 0 },
  threeQuarterL: { type: Number, default: 0 },
  halfL: { type: Number, default: 0 }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  sales: [saleSchema],
  lastActive: { type: Number, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ username: 1 });

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  quantity: { type: String, required: true },
  status: { type: String, default: "Pending" },
  timestamp: { type: Date, default: Date.now }
});

orderSchema.index({ username: 1, timestamp: -1 });

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
    if (!username) return res.status(400).json({ error: "Username required" });
    
    await User.updateOne({ username }, { lastActive: lastActive || Date.now() });
    res.json({ success: true });
  } catch (e) {
    console.error("Update activity error:", e);
    res.status(500).json({ error: "Error updating activity" });
  }
});

// Delete user
app.post('/delete-user', checkDB, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'Username required' });
    }
    
    const result = await User.deleteOne({ username });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await Order.deleteMany({ username });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ success: false, error: "Error deleting user" });
  }
});

// Register
app.post("/register", checkDB, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      username, 
      password: hashedPassword, 
      sales: [],
      lastActive: Date.now()
    });
    
    res.json({ success: true, username: user.username });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ error: "Error registering user" });
  }
});

// Login
app.post("/login", checkDB, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    
    // Admin check
    if (username === "admin" && password === "admin123") {
      return res.json({ role: "admin", username: "admin" });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    
    user.lastActive = Date.now();
    await user.save();
    
    res.json({ username: user.username, role: "user" });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login error" });
  }
});

// Get User Data
app.get("/user/:username", checkDB, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Sort sales by date
    if (user.sales && user.sales.length > 0) {
      user.sales.sort((a, b) => {
        const [d1, m1, y1] = a.date.split('/').map(Number);
        const [d2, m2, y2] = b.date.split('/').map(Number);
        return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
      });
    }
    
    res.json(user);
  } catch (e) {
    console.error("Fetch user error:", e);
    res.status(500).json({ error: "Error fetching user" });
  }
});

// Change Password
app.post("/change-password", checkDB, async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    
    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "All fields required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect old password" });
    
    const hashedNew = await bcrypt.hash(newPassword, 10);
    user.password = hashedNew;
    await user.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error("Change password error:", e);
    res.status(500).json({ error: "Error changing password" });
  }
});

// Add Sale
app.post("/add-sale", checkDB, async (req, res) => {
  try {
    const { username, sale } = req.body;
    
    if (!username || !sale || !sale.date) {
      return res.status(400).json({ error: "Invalid data" });
    }
    
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    
    const existingIndex = user.sales.findIndex(s => s.date === sale.date);
    
    if (existingIndex !== -1) {
      user.sales[existingIndex] = {
        date: sale.date,
        twoL: sale.twoL || 0,
        oneL: sale.oneL || 0,
        threeQuarterL: sale.threeQuarterL || 0,
        halfL: sale.halfL || 0
      };
    } else {
      user.sales.push({
        date: sale.date,
        twoL: sale.twoL || 0,
        oneL: sale.oneL || 0,
        threeQuarterL: sale.threeQuarterL || 0,
        halfL: sale.halfL || 0
      });
    }
    
    await user.save();
    res.json({ success: true });
  } catch (e) {
    console.error("Add sale error:", e);
    res.status(500).json({ error: "Error adding sale" });
  }
});

// Delete Sale
app.post("/delete-sale", checkDB, async (req, res) => {
  try {
    const { username, date } = req.body;
    
    if (!username || !date) {
      return res.status(400).json({ error: "Username and date required" });
    }
    
    await User.updateOne({ username }, { $pull: { sales: { date } } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete sale error:", err);
    res.status(500).json({ error: "Error deleting sale" });
  }
});

// Admin: Get All Users
app.get("/users", checkDB, async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    res.json(users);
  } catch (e) {
    console.error("Fetch users error:", e);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// Place Order
app.post("/place-order", checkDB, async (req, res) => {
  try {
    const { username, quantity } = req.body;
    
    if (!username || !quantity) {
      return res.status(400).json({ error: "Username and quantity required" });
    }
    
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await Order.create({
      id: orderId,
      username,
      quantity,
      status: "Pending",
      timestamp: new Date()
    });
    
    res.json({ success: true, orderId });
  } catch (e) {
    console.error("Place order error:", e);
    res.status(500).json({ error: "Error placing order" });
  }
});

// Get All Orders
app.get("/orders", checkDB, async (req, res) => {
  try {
    const orders = await Order.find().sort({ timestamp: -1 }).lean();
    res.json(orders);
  } catch (e) {
    console.error("Fetch orders error:", e);
    res.status(500).json({ error: "Error fetching orders" });
  }
});

// Get User Orders
app.get("/orders/:username", checkDB, async (req, res) => {
  try {
    const orders = await Order.find({ username: req.params.username })
      .sort({ timestamp: -1 })
      .lean();
    res.json(orders);
  } catch (e) {
    console.error("Fetch user orders error:", e);
    res.status(500).json({ error: "Error fetching user orders" });
  }
});

// Update Order Status
app.post("/update-order", checkDB, async (req, res) => {
  try {
    const { id, status } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({ error: "Order ID and status required" });
    }
    
    const result = await Order.findOneAndUpdate({ id }, { status }, { new: true });
    
    if (!result) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.json({ success: true, order: result });
  } catch (e) {
    console.error("Update order error:", e);
    res.status(500).json({ error: "Error updating order" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Closing server gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
