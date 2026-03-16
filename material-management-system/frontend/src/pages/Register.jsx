import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/index.js';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await register(formData);
      if (res.message === '注册成功') {
        navigate('/login');
      } else {
        setError(res.message || '注册失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">创建账户</h2>
      <p className="form-subtitle">加入素材管理系统</p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">用户名</label>
          <input
            className="form-input"
            type="text"
            name="username"
            placeholder="3-20 位字母、数字或中文"
            value={formData.username}
            onChange={handleChange}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label className="form-label">邮箱</label>
          <input
            className="form-input"
            type="email"
            name="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label className="form-label">密码</label>
          <input
            className="form-input"
            type="password"
            name="password"
            placeholder="至少 6 位字符"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
      <p className="form-link">
        已有账户？<Link to="/login">立即登录</Link>
      </p>
    </div>
  );
}
