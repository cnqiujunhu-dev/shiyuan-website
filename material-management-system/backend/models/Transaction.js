const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'purchase_self',
        'purchase_activity',
        'purchase_sponsor',
        'sponsored',
        'transfer_out',
        'transfer_in',
        'buyback',
        'assisted_buyback',
        'lottery',
        'retirement_drop'
      ],
      required: true
    },
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    target_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    price: { type: Number },
    points_change: { type: Number },
    annual_spend_change: { type: Number, default: 0 },
    transfer_remaining_after: { type: Number },
    buyback_remaining_after: { type: Number },
    has_delivery_link: { type: Boolean, default: false },
    occurred_at: { type: Date, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

transactionSchema.index({ actor_id: 1, occurred_at: -1 });
transactionSchema.index({ actor_id: 1, type: 1, occurred_at: -1 });
transactionSchema.index({ item_id: 1, occurred_at: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
