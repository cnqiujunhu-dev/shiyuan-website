const fs = require('fs');
const path = require('path');
const Asset = require('../models/asset');

/**
 * Upload a new asset. Expects `req.file` from multer middleware
 * and optional fields `description`, `tags`, `category`.
 */
exports.uploadAsset = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '未检测到上传文件' });
  }
  const { description, tags, category } = req.body;
  const file = req.file;
  try {
    const asset = await Asset.create({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      size: file.size,
      mimeType: file.mimetype,
      description,
      tags: tags ? tags.split(',').map((t) => t.trim()) : [],
      category,
      owner: req.user.id
    });
    return res.status(201).json({ message: '上传成功', asset });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Get list of assets with optional filters and pagination.
 */
exports.getAssets = async (req, res) => {
  const { q, tags, category, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (q) {
    // Search in originalName, description and tags
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { originalName: regex },
      { description: regex },
      { tags: regex }
    ];
  }
  if (tags) {
    const tagArray = tags.split(',').map((t) => t.trim());
    filter.tags = { $all: tagArray };
  }
  if (category) {
    filter.category = category;
  }
  try {
    const total = await Asset.countDocuments(filter);
    const assets = await Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    return res.status(200).json({ total, page: Number(page), assets });
  } catch (err) {
    console.error('Get assets error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Get a single asset by id.
 */
exports.getAssetById = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id).populate('owner', 'username email');
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    return res.status(200).json({ asset });
  } catch (err) {
    console.error('Get asset error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Update asset metadata.
 */
exports.updateAsset = async (req, res) => {
  const { id } = req.params;
  const { description, tags, category } = req.body;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    // Only owner or admin can update
    if (asset.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权限修改' });
    }
    if (description !== undefined) asset.description = description;
    if (tags !== undefined) asset.tags = tags.split(',').map((t) => t.trim());
    if (category !== undefined) asset.category = category;
    await asset.save();
    return res.status(200).json({ message: '更新成功', asset });
  } catch (err) {
    console.error('Update asset error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Delete asset and remove file from disk.
 */
exports.deleteAsset = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    // Only owner or admin can delete
    if (asset.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权限删除' });
    }
    // Delete file
    if (fs.existsSync(asset.filePath)) {
      fs.unlinkSync(asset.filePath);
    }
    await asset.deleteOne();
    return res.status(200).json({ message: '删除成功' });
  } catch (err) {
    console.error('Delete asset error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Download asset by id. Only authorized users can download.
 */
exports.downloadAsset = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    // Here we could enforce more granular permissions if needed
    return res.download(asset.filePath, asset.originalName);
  } catch (err) {
    console.error('Download asset error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};