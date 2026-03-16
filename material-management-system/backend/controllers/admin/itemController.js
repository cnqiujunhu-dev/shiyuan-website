const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Item = require('../../models/Item');
const Ownership = require('../../models/Ownership');
const logger = require('../../config/logger');

const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'items');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `item_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('只允许上传图片文件'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

exports.uploadMiddleware = (req, res, next) => {
  upload.single('preview')(req, res, (err) => {
    if (err instanceof multer.MulterError || err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

exports.createItem = async (req, res) => {
  try {
    const { name, artist, categories, price, delivery_link, status } = req.body;
    const preview_url = req.file ? req.file.path.replace(/\\/g, '/') : undefined;
    const item = await Item.create({
      name,
      artist,
      categories: Array.isArray(categories) ? categories : (categories ? [categories] : []),
      price: Number(price),
      preview_url,
      delivery_link,
      status: status || 'on_sale'
    });
    logger.info('Item created', { itemId: item._id, name });
    return res.status(201).json({ message: '商品创建成功', item });
  } catch (err) {
    logger.error('createItem error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  try {
    const { name, artist, categories, price, delivery_link, status } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (artist !== undefined) updates.artist = artist;
    if (categories !== undefined) updates.categories = Array.isArray(categories) ? categories : [categories];
    if (price !== undefined) updates.price = Number(price);
    if (delivery_link !== undefined) updates.delivery_link = delivery_link;
    if (status !== undefined) updates.status = status;
    if (req.file) updates.preview_url = req.file.path.replace(/\\/g, '/');

    const item = await Item.findByIdAndUpdate(id, updates, { new: true });
    if (!item) {
      return res.status(404).json({ message: '商品不存在' });
    }
    logger.info('Item updated', { itemId: id });
    return res.json({ message: '商品已更新', item });
  } catch (err) {
    logger.error('updateItem error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItems = async (req, res) => {
  const { page = 1, limit = 20, status, artist } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (status) filter.status = status;
    if (artist) filter.artist = new RegExp(artist, 'i');
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, items });
  } catch (err) {
    logger.error('getItems error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItemOwnerships = async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { item_id: id, active: true };
    const total = await Ownership.countDocuments(filter);
    const ownerships = await Ownership.find(filter)
      .populate('user_id', 'username qq platform platform_id')
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, ownerships });
  } catch (err) {
    logger.error('getItemOwnerships error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
