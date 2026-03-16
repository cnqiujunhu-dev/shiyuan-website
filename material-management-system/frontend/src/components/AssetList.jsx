import React from 'react';
import AssetCard from './AssetCard.jsx';

/**
 * Display a list of assets.
 * @param {Object} props
 * @param {Array} props.assets Array of asset objects
 * @param {Function} props.onDelete Callback when an asset is deleted
 */
export default function AssetList({ assets, onDelete }) {
  if (!assets || assets.length === 0) {
    return <p>暂无素材</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
      {assets.map((asset) => (
        <AssetCard key={asset._id} asset={asset} onDelete={onDelete} />
      ))}
    </div>
  );
}