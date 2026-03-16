const mongoose = require('mongoose');

const ownershipSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    acquisition_type: {
      type: String,
      enum: ['self', 'sponsored', 'transfer_in', 'transfer_out'],
      required: true
    },
    points_delta: { type: Number, required: true },
    occurred_at: { type: Date, required: true },
    delivery_link: { type: String },
    source_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replaced_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Ownership' },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

ownershipSchema.index({ user_id: 1, occurred_at: -1 });

module.exports = mongoose.model('Ownership', ownershipSchema);
