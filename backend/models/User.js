const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  date: String,
  oneL: Number,
  halfL: Number,
  quarterL: Number
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  sales: [saleSchema]
});

module.exports = mongoose.model("User", userSchema);
