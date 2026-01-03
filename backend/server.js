require("dotenv").config();
require("./db");
const User = require("./models/User");
const Order = require("./models/Order");
const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
// Serve static files from public folder
app.use(express.static(path.join(__dirname, "../public")));

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ROUTES
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: "User exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, sales: [] });
    res.json(user);
  } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") return res.json({ role: "admin" });
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json(null);
  res.json({ username: user.username, role: "user" });
});

// ✅ NEW: Change Password Route
app.post("/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) return res.status(400).json({ error: "Incorrect old password" });

  const hashedNew = await bcrypt.hash(newPassword, 10);
  user.password = hashedNew;
  await user.save();
  res.json({ success: true });
});

app.get("/user/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username }).lean();
  res.json(user);
});

app.get("/users", async (req, res) => {
  const users = await User.find().lean();
  res.json(users);
});

app.post("/add-sale", async (req, res) => {
  const { username, sale } = req.body;
  const user = await User.findOne({ username });
  const existing = user.sales.find(s => s.date === sale.date);
  if (existing) {
    existing.twoL = sale.twoL; existing.oneL = sale.oneL; 
    existing.threeQuarterL = sale.threeQuarterL; existing.halfL = sale.halfL;
  } else { user.sales.push(sale); }
  await user.save();
  res.json({ success: true });
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.post("/delete-sale", async (req, res) => {
  try {
    const { username, date } = req.body;
    await User.updateOne({ username }, { $pull: { sales: { date } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error" }); }
});

app.post("/place-order", async (req, res) => {
  await Order.create({ ...req.body, id: Date.now().toString(), status: "Pending", timestamp: new Date() });
  res.json({ success: true });
});

app.get("/orders", async (req, res) => { 
  const orders = await Order.find().sort({ timestamp: -1 }).lean();
  res.json(orders);
});

app.get("/orders/:username", async (req, res) => { 
  const orders = await Order.find({ username: req.params.username }).sort({ timestamp: -1 }).lean();
  res.json(orders);
});

app.post("/update-order", async (req, res) => {
  const { id, status } = req.body;
  await Order.findOneAndUpdate({ id }, { status });
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
