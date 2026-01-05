const mongoose = require("mongoose");

/* ===== Milk Sale Schema ===== */
const SaleSchema = new mongoose.Schema({
  date: String, // DD/MM/YYYY
  twoL: { type: Number, default: 0 },
  oneL: { type: Number, default: 0 },
  threeQuarterL: { type: Number, default: 0 },
  halfL: { type: Number, default: 0 }
}, { _id: false });

/* ===== Order Schema ===== */
const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true },
  quantity: { type: Number, required: true }, // 1, 2, 0.5
  status: {
    type: String,
    enum: ["Pending", "Success", "Rejected"],
    default: "Pending"
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/* ===== User Schema ===== */
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  sales: {
    type: [SaleSchema],
    default: []
  },

  orders: {
    type: [OrderSchema],
    default: []
  },

  lastActive: {
    type: Number,
    default: null
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("User", UserSchema);
