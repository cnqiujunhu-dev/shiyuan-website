const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Asset = require('../models/asset');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

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
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      category,
      owner: req.user.id
    });
    logger.info('Asset uploaded', { assetId: asset._id, filename: file.originalname, userId: req.user.id });
    return res.status(201).json({ message: '上传成功', asset });
  } catch (err) {
    // Clean up uploaded file on DB error
    if (fsSync.existsSync(file.path)) {
      await fs.unlink(file.path).catch(() => {});
    }
    logger.error('Upload error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getAssets = async (req, res) => {
  const { q, tags, category, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ originalName: regex }, { description: regex }, { tags: regex }];
  }
  if (tags) {
    const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
    filter.tags = { $all: tagArray };
  }
  if (category) {
    filter.category = category;
  }
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const total = await Asset.countDocuments(filter);
    const assets = await Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.status(200).json({ total, page: pageNum, assets });
  } catch (err) {
    logger.error('Get assets error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getAssetById = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id).populate('owner', 'username email');
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    return res.status(200).json({ asset });
  } catch (err) {
    logger.error('Get asset error', { message: err.message, id });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateAsset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  const { id } = req.params;
  const { description, tags, category } = req.body;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    if (asset.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权限修改' });
    }
    if (description !== undefined) asset.description = description;
    if (tags !== undefined) asset.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (category !== undefined) asset.category = category;
    await asset.save();
    logger.info('Asset updated', { assetId: id, userId: req.user.id });
    return res.status(200).json({ message: '更新成功', asset });
  } catch (err) {
    logger.error('Update asset error', { message: err.message, id });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.deleteAsset = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    if (asset.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权限删除' });
    }
    // Async file deletion - don't block response on FS failure
    await fs.unlink(asset.filePath).catch((e) => {
      logger.warn('Failed to delete file', { filePath: asset.filePath, error: e.message });
    });
    await asset.deleteOne();
    logger.info('Asset deleted', { assetId: id, userId: req.user.id });
    return res.status(200).json({ message: '删除成功' });
  } catch (err) {
    logger.error('Delete asset error', { message: err.message, id });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.downloadAsset = async (req, res) => {
  const { id } = req.params;
  try {
    const asset = await Asset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: '未找到该素材' });
    }
    logger.info('Asset downloaded', { assetId: id, userId: req.user.id });
    return res.download(asset.filePath, asset.originalName);
  } catch (err) {
    logger.error('Download asset error', { message: err.message, id });
    return res.status(500).json({ message: '服务器错误' });
  }
};
