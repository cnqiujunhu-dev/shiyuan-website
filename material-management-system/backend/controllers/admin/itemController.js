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
    const {
      sku_code,
      name,
      artist,
      categories,
      topics,
      price,
      delivery_link,
      status,
      priority_only,
      queue_enabled
    } = req.body;
    const preview_url = req.file ? req.file.path.replace(/\\/g, '/') : (req.body.preview_url || undefined);

    const parsedTopics = topics ? (Array.isArray(topics) ? topics : JSON.parse(topics)) : [];
    const parsedCategories = categories ? (Array.isArray(categories) ? categories : JSON.parse(categories)) : [];

    const item = await Item.create({
      sku_code: sku_code || undefined,
      name,
      artist,
      topics: parsedTopics,
      categories: parsedCategories,
      price: Number(price),
      preview_url,
      delivery_link,
      status: status || 'on_sale',
      priority_only: String(priority_only) === 'true' || priority_only === true,
      queue_enabled: String(queue_enabled) === 'true' || queue_enabled === true
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
    const {
      sku_code,
      name,
      artist,
      categories,
      topics,
      price,
      delivery_link,
      status,
      priority_only,
      queue_enabled
    } = req.body;
    const updates = {};
    if (sku_code !== undefined) updates.sku_code = sku_code;
    if (name !== undefined) updates.name = name;
    if (artist !== undefined) updates.artist = artist;
    if (topics !== undefined) updates.topics = Array.isArray(topics) ? topics : JSON.parse(topics);
    if (categories !== undefined) updates.categories = Array.isArray(categories) ? categories : JSON.parse(categories);
    if (price !== undefined) updates.price = Number(price);
    if (delivery_link !== undefined) updates.delivery_link = delivery_link;
    if (status !== undefined) updates.status = status;
    if (priority_only !== undefined) updates.priority_only = String(priority_only) === 'true' || priority_only === true;
    if (queue_enabled !== undefined) updates.queue_enabled = String(queue_enabled) === 'true' || queue_enabled === true;
    if (req.file) updates.preview_url = req.file.path.replace(/\\/g, '/');
    if (req.body.preview_url !== undefined && !req.file) updates.preview_url = req.body.preview_url;

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

exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: '商品不存在' });
    return res.json({ item });
  } catch (err) {
    logger.error('getItemById error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItems = async (req, res) => {
  const { page = 1, limit = 20, status, artist, name } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (status) filter.status = status;
    if (artist) filter.artist = new RegExp(artist, 'i');
    if (name) filter.name = new RegExp(name, 'i');
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

exports.importItems = async (req, res) => {
  const { items: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: '请提供商品数据数组' });
  }
  try {
    const results = { success: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !row.artist || !row.price) {
          results.errors.push({ index: i, name: row.name || `第${i + 1}行`, error: '缺少必填字段(name/artist/price)' });
          continue;
        }
        await Item.create({
          sku_code: row.sku_code || undefined,
          name: row.name,
          artist: row.artist,
          topics: Array.isArray(row.topics) ? row.topics : (row.topics ? [row.topics] : []),
          categories: Array.isArray(row.categories) ? row.categories : (row.categories ? [row.categories] : []),
          price: Number(row.price),
          preview_url: row.preview_url || undefined,
          delivery_link: row.delivery_link || '',
          status: row.status || 'on_sale',
          priority_only: !!row.priority_only,
          queue_enabled: !!row.queue_enabled
        });
        results.success++;
      } catch (err) {
        results.errors.push({ index: i, name: row.name || `第${i + 1}行`, error: err.message });
      }
    }
    logger.info('Items batch imported', { success: results.success, errors: results.errors.length });
    return res.json({ message: `成功导入 ${results.success} 件，失败 ${results.errors.length} 件`, ...results });
  } catch (err) {
    logger.error('importItems error', { message: err.message });
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
      .populate('source_user_id', 'username qq')
      .populate('target_user_id', 'username qq')
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
