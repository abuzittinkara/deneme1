// models/FileAttachment.js
const mongoose = require('mongoose');

const FileAttachmentSchema = new mongoose.Schema({
  // Original filename provided by the user
  originalName: { type: String, required: true },
  // Server-generated filename (to avoid conflicts)
  serverFilename: { type: String, required: true, unique: true },
  // MIME type of the file
  mimeType: { type: String, required: true },
  // File size in bytes
  size: { type: Number, required: true },
  // Upload timestamp
  uploadDate: { type: Date, default: Date.now },
  // User who uploaded the file
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Message this file is attached to (optional - could be null for profile pictures)
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  // DM message this file is attached to (optional)
  dmMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'DMMessage' },
  // Path where the file is stored on the server
  path: { type: String, required: true }
});

module.exports = mongoose.model('FileAttachment', FileAttachmentSchema);
