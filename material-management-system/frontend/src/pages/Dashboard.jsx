import React, { useEffect, useState } from 'react';
import { fetchAssets, deleteAsset } from '../api/index.js';
import AssetList from '../components/AssetList.jsx';

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const loadAssets = async () => {
    setLoading(true);
    const res = await fetchAssets({ q: query, page, limit });
    setAssets(res.assets || []);
    setTotal(res.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadAssets();
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定删除该素材吗？')) {
      const res = await deleteAsset(id);
      alert(res.message);
      loadAssets();
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>素材列表</h2>
      <form onSubmit={handleSearch} style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="搜索关键词"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">搜索</button>
      </form>
      {loading ? (
        <p>加载中...</p>
      ) : (
        <AssetList assets={assets} onDelete={handleDelete} />
      )}
      <div style={{ marginTop: '10px' }}>
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
        >
          上一页
        </button>
        <span style={{ margin: '0 10px' }}>
          第 {page} 页，共 {Math.ceil(total / limit)} 页
        </span>
        <button
          disabled={page >= Math.ceil(total / limit)}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}