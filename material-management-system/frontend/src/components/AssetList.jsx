import React from 'react';
import AssetCard from './AssetCard.jsx';

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-icon" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line" style={{ width: '85%' }} />
        <div className="skeleton skeleton-line skeleton-line-short" />
        <div className="skeleton skeleton-line skeleton-line-xs" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <div className="skeleton skeleton-line" style={{ height: 28, flex: 1 }} />
          <div className="skeleton skeleton-line" style={{ height: 28, width: 60 }} />
        </div>
      </div>
    </div>
  );
}

export default function AssetList({ assets, loading, onDelete }) {
  if (loading) {
    return (
      <div className="asset-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-text">暂无素材，点击右上角上传第一个文件吧</div>
      </div>
    );
  }

  return (
    <div className="asset-grid">
      {assets.map((asset) => (
        <AssetCard key={asset._id} asset={asset} onDelete={onDelete} />
      ))}
    </div>
  );
}
