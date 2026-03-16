import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { uploadAsset } from '../api/index.js';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('请选择要上传的文件');
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('category', category);
    try {
      const res = await uploadAsset(formData);
      if (res.asset) {
        navigate('/');
      } else {
        setError(res.message || '上传失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2 className="form-title">上传素材</h2>
      <p className="form-subtitle">支持图片、视频、音频、文档等格式，单文件最大 100MB</p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files[0])}
          />
          <div className="upload-zone-icon">☁️</div>
          <div className="upload-zone-text">点击选择文件，或拖拽到此处</div>
          <div className="upload-zone-hint">图片 / 视频 / 音频 / PDF / 文档 / ZIP</div>
        </div>

        {file && (
          <div className="selected-file">
            📄 <span>{file.name}</span>
            <span className="selected-file-size">{formatSize(file.size)}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">描述</label>
          <input
            className="form-input"
            type="text"
            placeholder="为这个素材添加描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">标签</label>
          <input
            className="form-input"
            type="text"
            placeholder="多个标签用逗号分隔，如：设计,UI,图标"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">分类</label>
          <input
            className="form-input"
            type="text"
            placeholder="如：图片、视频、文档（可选）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1, padding: '11px' }}
            disabled={loading}
          >
            {loading ? '上传中...' : '上传'}
          </button>
          <Link to="/" className="btn btn-ghost" style={{ padding: '11px 20px' }}>
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
