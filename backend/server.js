const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "raithupalu@gmail.com",      // 🔴 replace
    pass: "raithu@7914"         // 🔴 app password
  }
});

/* ---------- FILE HELPERS ---------- */
function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_FILE))
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

function readUsers() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeUsers(users) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function ensureOrdersFile() {
  if (!fs.existsSync(ORDERS_FILE))
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}

function readOrders() {
  ensureOrdersFile();
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
}

function writeOrders(orders) {
  ensureOrdersFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

/* YYYY-MM-DD → DD/MM/YYYY */
function toDDMMYYYY(date) {
  if (date.includes("-")) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }
  return date;
}

/* ---------- ROUTES ---------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/* REGISTER (NO EMAIL) */
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: "All fields are required" });
  }

  const users = readUsers();

  const cleanUsername = username.trim().toLowerCase();

  const userExists = users.some(
    u => u.username.trim().toLowerCase() === cleanUsername
  );

  if (userExists) {
    return res.json({ error: "User already exists" });
  }

  const newUser = {
    username: username.trim(),
    password: password.trim(),
    sales: []
  };

  users.push(newUser);
  writeUsers(users);

  res.json({ success: true });
});


/* LOGIN */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123")
    return res.json({ role: "admin" });

  const users = readUsers();
  const user = users.find(
    u => u.username === username && u.password === password
  );

  res.json(user || null);
});

/* CHANGE PASSWORD */
app.post("/change-password", (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res.json({ error: "All fields are required" });
  }

  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (!user || user.password !== oldPassword) {
    return res.json({ error: "Invalid credentials" });
  }

  user.password = newPassword;
  writeUsers(users);

  res.json({ success: true });
});

/* ADMIN GET USERS */
app.get("/users", (req, res) => {
  res.json(readUsers());
});

function sendMonthlyReports() {
  const users = readUsers();

  users.forEach(user => {
    if (!user.email) return; // skip if no email

    let total1L = 0, totalHalf = 0, totalQuarter = 0, totalAmount = 0;

    user.sales.forEach(s => {
      total1L += s.oneL;
      totalHalf += s.halfL;
      totalQuarter += s.quarterL;
      totalAmount +=
        (s.oneL * 70) + (s.halfL * 35) + (s.quarterL * 18);
    });

    const mailOptions = {
      from: "RAITHU PAALU <yourgmail@gmail.com>",
      to: user.email,
      subject: "Monthly Milk Report - RAITHU PAALU",
      html: `
        <h2>Dear ${user.username},</h2>
        <p>Here is your monthly milk report:</p>
        <ul>
          <li>1 Litre: ${total1L} → ₹${total1L * 70}</li>
          <li>½ Litre: ${totalHalf} → ₹${totalHalf * 35}</li>
          <li>¼ Litre: ${totalQuarter} → ₹${totalQuarter * 18}</li>
        </ul>
        <h3>Total Amount: ₹${totalAmount}</h3>
        <p>Thank you for supporting farmers 🌾</p>
        <b>RAITHU PAALU</b>
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Email error:", err);
      else console.log(`Email sent to ${user.username}`);
    });
  });
}

/* ADD OR UPDATE SALE (FIXED) */
app.post("/add-sale", (req, res) => {
  const { username, sale } = req.body;

  if (!sale.date)
    return res.json({ error: "Date required" });

  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ error: "User not found" });

  const date = toDDMMYYYY(sale.date);

  const idx = user.sales.findIndex(s => s.date === date);
  if (idx !== -1) {
    // UPDATE
    user.sales[idx] = {
      date,
      oneL: sale.oneL,
      halfL: sale.halfL,
      quarterL: sale.quarterL
    };
  } else {
    // ADD
    user.sales.push({
      date,
      oneL: sale.oneL,
      halfL: sale.halfL,
      quarterL: sale.quarterL
    });
  }

  writeUsers(users);
  res.json({ success: true });
});

/* DELETE SALE */
app.post("/delete-sale", (req, res) => {
  const { username, date } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);

  user.sales = user.sales.filter(s => s.date !== date);
  writeUsers(users);

  res.json({ success: true });
});

/* DELETE USER */
app.post("/delete-user", (req, res) => {
  let users = readUsers();
  users = users.filter(u => u.username !== req.body.username);
  writeUsers(users);
  res.json({ success: true });
});

/* PLACE ORDER */
app.post("/place-order", (req, res) => {
  const { username, quantity } = req.body;

  if (!username || !quantity) {
    return res.json({ error: "Username and quantity required" });
  }

  const orders = readOrders();
  const newOrder = {
    id: Date.now().toString(),
    username,
    quantity: parseFloat(quantity),
    status: 'pending',
    timestamp: new Date().toISOString()
  };

  orders.push(newOrder);
  writeOrders(orders);

  res.json({ success: true });
});

/* GET USER ORDERS */
app.get("/orders/:username", (req, res) => {
  const orders = readOrders();
  const userOrders = orders.filter(o => o.username === req.params.username);
  res.json(userOrders);
});

/* GET ALL ORDERS (ADMIN) */
app.get("/all-orders", (req, res) => {
  res.json(readOrders());
});

/* UPDATE ORDER STATUS */
app.post("/update-order-status", (req, res) => {
  const { id, status } = req.body;

  const orders = readOrders();
  const order = orders.find(o => o.id === id);

  if (order) {
    order.status = status;
    writeOrders(orders);
    res.json({ success: true });
  } else {
    res.json({ error: "Order not found" });
  }
});

/* START */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

// Run at 9 AM on 1st of every month
cron.schedule("0 9 1 * *", () => {
  console.log("📧 Sending monthly milk reports...");
  sendMonthlyReports();
});
sendMonthlyReports();
