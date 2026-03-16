const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['platform_change', 'print_report', 'buyback'], required: true },
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

module.exports = mongoose.model('Application', applicationSchema);
