const mongoose = require('mongoose');

const vipLevelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, unique: true },
    threshold: { type: Number, required: true },
    perks: {
      buyback_per_year: { type: Number, default: 0 },
      assisted_buyback_per_year: { type: Number, default: 0 },
      transfer_per_year: { type: Number, default: 0 },
      skip_queue_per_year: { type: Number, default: 0 },
      priority_buy: { type: Boolean, default: false }
    },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('VipLevel', vipLevelSchema);
