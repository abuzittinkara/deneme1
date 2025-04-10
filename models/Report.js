// models/Report.js
const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { 
    type: String, 
    enum: [
      'harassment', 
      'spam', 
      'inappropriate_content', 
      'threats', 
      'impersonation', 
      'other'
    ], 
    required: true 
  },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'investigating', 'resolved', 'dismissed'], 
    default: 'pending' 
  },
  relatedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  relatedDMMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DMMessage' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution: { type: String },
  isArchived: { type: Boolean, default: false }
});

module.exports = mongoose.model('Report', ReportSchema);
