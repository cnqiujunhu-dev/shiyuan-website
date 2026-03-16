import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadAsset } from '../api/index.js';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
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
    const res = await uploadAsset(formData);
    setLoading(false);
    if (res.asset) {
      navigate('/');
    } else {
      setError(res.message || '上传失败');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto' }}>
      <h2>上传素材</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>选择文件：</label>
          <input type="file" onChange={handleFileChange} />
        </div>
        <div>
          <label>描述：</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label>标签（逗号分隔）：</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div>
          <label>分类：</label>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '上传中...' : '上传'}
        </button>
      </form>
    </div>
  );
}