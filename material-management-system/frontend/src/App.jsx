import React, { Component } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';

const isAuthenticated = () => Boolean(localStorage.getItem('token'));

const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-icon">⚠️</div>
          <div className="error-boundary-title">页面发生错误</div>
          <p className="error-boundary-msg">{this.state.error?.message}</p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function NavBar() {
  const navigate = useNavigate();
  const auth = isAuthenticated();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">📦 素材管理系统</Link>
      {auth ? (
        <>
          <Link to="/" className="nav-link">素材库</Link>
          <Link to="/upload" className="nav-link">上传</Link>
          <button className="btn-logout" onClick={handleLogout}>退出登录</button>
        </>
      ) : (
        <>
          <Link to="/login" className="nav-link">登录</Link>
          <Link to="/register" className="nav-link">注册</Link>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <div>
      <NavBar />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
