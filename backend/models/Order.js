const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  id: String,
  username: String,
  quantity: Number,
  status: { type: String, default: "pending" },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", OrderSchema);