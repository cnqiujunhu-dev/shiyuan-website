const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    artist: { type: String, required: true },
    categories: [{ type: String, enum: ['立绘', '通加', '场景', 'CG', '素材', '美工', '音乐'] }],
    price: { type: Number, required: true },
    preview_url: { type: String },
    delivery_link: { type: String },
    status: { type: String, enum: ['on_sale', 'off_sale'], default: 'on_sale' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('Item', itemSchema);
