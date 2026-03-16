import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAssets, deleteAsset } from '../api/index.js';
import AssetList from '../components/AssetList.jsx';
import Toast from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssets({ q: query, page, limit });
      setAssets(res.assets || []);
      setTotal(res.total || 0);
    } catch {
      addToast('加载素材失败，请刷新重试', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(inputValue);
    setPage(1);
  };

  const handleClear = () => {
    setInputValue('');
    setQuery('');
    setPage(1);
  };

  const handleDeleteRequest = (id, name) => setConfirm({ id, name });

  const handleDeleteConfirm = async () => {
    const { id, name } = confirm;
    setConfirm(null);
    try {
      const res = await deleteAsset(id);
      if (res.message === '删除成功') {
        addToast(`「${name}」已删除`, 'success');
        loadAssets();
      } else {
        addToast(res.message || '删除失败', 'error');
      }
    } catch {
      addToast('删除失败，请稍后重试', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page">
      <Toast toasts={toasts} />
      {confirm && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除「${confirm.name}」吗？此操作不可撤销。`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">素材库</h1>
          {!loading && <span className="badge">共 {total} 个文件</span>}
        </div>
        <Link to="/upload" className="btn btn-primary">＋ 上传素材</Link>
      </div>

      <form onSubmit={handleSearch} className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="搜索文件名、描述、标签..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">搜索</button>
        {inputValue && (
          <button type="button" className="btn btn-ghost" onClick={handleClear}>
            清除
          </button>
        )}
      </form>

      <AssetList assets={assets} loading={loading} onDelete={handleDeleteRequest} />

      {!loading && totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← 上一页
          </button>
          <span className="pagination-info">第 {page} / {totalPages} 页</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
