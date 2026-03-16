import React from 'react';

export default function AssetCard({ asset, onDelete }) {
  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/assets/download/${asset._id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('下载失败');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
      <h4>{asset.originalName}</h4>
      {asset.description && <p>描述：{asset.description}</p>}
      {asset.category && <p>分类：{asset.category}</p>}
      {asset.tags && asset.tags.length > 0 && (
        <p>
          标签：{asset.tags.join(', ')}
        </p>
      )}
      <p>上传时间：{new Date(asset.createdAt).toLocaleString()}</p>
      <button onClick={handleDownload}>下载</button>
      <button onClick={() => onDelete(asset._id)} style={{ marginLeft: '5px', color: 'red' }}>
        删除
      </button>
    </div>
  );
}