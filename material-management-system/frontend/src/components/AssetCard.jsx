import React, { useState } from 'react';
import { downloadAsset } from '../api/index.js';

const FILE_ICONS = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📄',
  zip: '📦',
  word: '📝',
  excel: '📊',
  ppt: '📊',
  text: '📃',
  default: '📁'
};

function getFileIcon(mimeType) {
  if (!mimeType) return FILE_ICONS.default;
  if (mimeType.startsWith('image/')) return FILE_ICONS.image;
  if (mimeType.startsWith('video/')) return FILE_ICONS.video;
  if (mimeType.startsWith('audio/')) return FILE_ICONS.audio;
  if (mimeType === 'application/pdf') return FILE_ICONS.pdf;
  if (mimeType.includes('zip')) return FILE_ICONS.zip;
  if (mimeType.includes('word') || mimeType.includes('document')) return FILE_ICONS.word;
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return FILE_ICONS.excel;
  if (mimeType.includes('presentation')) return FILE_ICONS.ppt;
  if (mimeType.startsWith('text/')) return FILE_ICONS.text;
  return FILE_ICONS.default;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AssetCard({ asset, onDelete }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAsset(asset._id, asset.originalName);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-icon">{getFileIcon(asset.mimeType)}</div>
      <div className="card-body">
        <div className="card-title" title={asset.originalName}>
          {asset.originalName}
        </div>
        {asset.description && (
          <div className="card-meta">📝 {asset.description}</div>
        )}
        {asset.category && (
          <div className="card-meta">📂 {asset.category}</div>
        )}
        <div className="card-meta">
          📏 {formatSize(asset.size)} · {new Date(asset.createdAt).toLocaleDateString('zh-CN')}
        </div>
        {asset.tags?.length > 0 && (
          <div className="card-tags">
            {asset.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
        <div className="card-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDownload}
            disabled={downloading}
            style={{ flex: 1 }}
          >
            {downloading ? '下载中...' : '⬇️ 下载'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(asset._id, asset.originalName)}
          >
            🗑️ 删除
          </button>
        </div>
      </div>
    </div>
  );
}
