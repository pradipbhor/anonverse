const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true
  },
  recipientId: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxLength: 1000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  metadata: {
    interests: [String],
    mode: {
      type: String,
      enum: ['text', 'video'],
      default: 'text'
    }
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  deletedAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    index: { expireAfterSeconds: 0 } // TTL index for automatic deletion
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, createdAt: -1 });
// messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if message is expired
messageSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark message as read
messageSchema.methods.markAsRead = async function() {
  this.status = 'read';
  return await this.save();
};

// Method to mark message as delivered
messageSchema.methods.markAsDelivered = async function() {
  if (this.status === 'sent') {
    this.status = 'delivered';
    return await this.save();
  }
  return this;
};

// Static method to get room messages
messageSchema.statics.getRoomMessages = async function(roomId, limit = 50, skip = 0) {
  return await this.find({ 
    roomId,
    deletedAt: { $exists: false }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .lean();
};

// Static method to delete room messages after disconnect
messageSchema.statics.scheduleRoomDeletion = async function(roomId, hours = 12) {
  const expirationTime = new Date(Date.now() + hours * 60 * 60 * 1000);
  
  return await this.updateMany(
    { roomId },
    { 
      $set: { 
        expiresAt: expirationTime 
      } 
    }
  );
};

// Static method to immediately delete room messages
messageSchema.statics.deleteRoomMessages = async function(roomId) {
  return await this.deleteMany({ roomId });
};

// Static method to get unread messages count
messageSchema.statics.getUnreadCount = async function(recipientId, roomId) {
  return await this.countDocuments({
    recipientId,
    roomId,
    status: { $in: ['sent', 'delivered'] }
  });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;