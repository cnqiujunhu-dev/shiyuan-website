const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    sku_code: { type: String },
    name: { type: String, required: true },
    artist: { type: String, required: true },
    material_domain: { type: String }, // legacy only; authorization usage fields live on Ownership.
    topics: [{ type: String }],
    categories: [{ type: String }],
    price: { type: Number, required: true },
    preview_url: { type: String },
    delivery_link: { type: String },
    status: { type: String, enum: ['on_sale', 'completed', 'off_sale'], default: 'on_sale' },
    priority_only: { type: Boolean, default: false },
    queue_enabled: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

itemSchema.index({ status: 1, created_at: -1 });
itemSchema.index({ artist: 1 });
itemSchema.index({ sku_code: 1 });

module.exports = mongoose.model('Item', itemSchema);
