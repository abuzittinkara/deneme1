// models/Category.js
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  position: { type: Number, default: 0 }
});

module.exports = mongoose.model('Category', CategorySchema);
