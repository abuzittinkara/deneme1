const mongoose = require('mongoose');

const DMMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // Fields for edited messages
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  originalContent: { type: String },
  // Field for deleted messages
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  // References to file attachments
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAttachment' }],
  // Message reactions
  reactions: {
    type: Map,
    of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: new Map()
  },
  // Reference to the message this message is quoting
  quotedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'DMMessage' }
});

module.exports = mongoose.model('DMMessage', DMMessageSchema);
