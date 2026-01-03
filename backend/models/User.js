const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({
  date: String, // Format: DD/MM/YYYY
  twoL: { type: Number, default: 0 },
  oneL: { type: Number, default: 0 },
  threeQuarterL: { type: Number, default: 0 }, // 0.75L
  halfL: { type: Number, default: 0 }          // 0.5L
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  sales: [SaleSchema]
});

module.exports = mongoose.model("User", UserSchema);