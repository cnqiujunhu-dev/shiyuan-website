import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/index.js';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ usernameOrEmail: '', password: '' });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const res = await login(formData);
    if (res.token) {
      localStorage.setItem('token', res.token);
      navigate('/');
    } else {
      setError(res.message || '登录失败');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>登录</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>用户名或邮箱：</label>
          <input
            type="text"
            name="usernameOrEmail"
            value={formData.usernameOrEmail}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>密码：</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit">登录</button>
      </form>
    </div>
  );
}