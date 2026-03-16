import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/index.js';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ usernameOrEmail: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(formData);
      if (res.token) {
        localStorage.setItem('token', res.token);
        navigate('/');
      } else {
        setError(res.message || '登录失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">欢迎回来</h2>
      <p className="form-subtitle">登录您的素材管理账户</p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">用户名或邮箱</label>
          <input
            className="form-input"
            type="text"
            name="usernameOrEmail"
            placeholder="请输入用户名或邮箱"
            value={formData.usernameOrEmail}
            onChange={handleChange}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label className="form-label">密码</label>
          <input
            className="form-input"
            type="password"
            name="password"
            placeholder="请输入密码"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <p className="form-link">
        还没有账户？<Link to="/register">立即注册</Link>
      </p>
    </div>
  );
}
