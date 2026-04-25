const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['buyback', 'registration'], required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payload: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decided_at: { type: Date },
    remark: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

applicationSchema.index({ user_id: 1, type: 1, status: 1 });
applicationSchema.index({ status: 1, type: 1, created_at: -1 });

module.exports = mongoose.model('Application', applicationSchema);
