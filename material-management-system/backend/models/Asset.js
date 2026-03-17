const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String, index: true }],
    category: { type: String },
    version: { type: Number, default: 1 },
    versions: [
      {
        fileName: String,
        filePath: String,
        uploadedAt: Date
      }
    ],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Asset', assetSchema);