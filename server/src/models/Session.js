const mongoose = require('mongoose');

const ElementSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['stroke', 'rectangle', 'circle', 'text', 'line', 'arrow', 'star', 'diamond']
    },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    version: { type: Number, default: 1 },
    updatedBy: { type: String },
    timestamp: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false }
  },
  { _id: false }
);

const SessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      default: 'Collaborative Board',
      trim: true
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    passcode: {
      type: String,
      default: ''
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    elements: [ElementSubSchema],
    users: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        color: { type: String },
        joinedAt: { type: Date, default: Date.now }
      }
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Optimize queries sharded/indexed by roomId
SessionSchema.index({ roomId: 1, lastUpdated: -1 });

module.exports = mongoose.model('Session', SessionSchema);
