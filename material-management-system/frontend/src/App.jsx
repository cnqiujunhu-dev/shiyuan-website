import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';

// Simple authentication check using localStorage
const isAuthenticated = () => {
  return Boolean(localStorage.getItem('token'));
};

// Protected route wrapper
const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" />;
};

export default function App() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };
  return (
    <div>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <Link to="/">主页</Link>
        {isAuthenticated() ? (
          <>
            {' | '}<Link to="/upload">上传</Link>{' | '}
            <button onClick={handleLogout}>退出登录</button>
          </>
        ) : (
          <>
            {' | '}<Link to="/login">登录</Link>{' | '}<Link to="/register">注册</Link>
          </>
        )}
      </nav>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/upload"
          element={
            <PrivateRoute>
              <Upload />
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}