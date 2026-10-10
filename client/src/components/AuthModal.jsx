import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Sparkles, User, Mail, Lock } from 'lucide-react';
import { loginSuccess } from '../store/authSlice';
import { setAuthModalOpen } from '../store/roomSlice';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '3000' ? 'http://localhost:5000' : '');

export const AuthModal = () => {
  const dispatch = useDispatch();
  const isOpen = useSelector((state) => state.room.isAuthModalOpen);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { email, password } : { username, email, password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        dispatch(loginSuccess({ token: data.token, user: data.user }));
        dispatch(setAuthModalOpen(false));
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch {
      setError('Cannot connect to server. Use Guest mode for local testing.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `Guest_${Math.floor(1000 + Math.random() * 9000)}` })
      });
      const data = await res.json();

      if (data.success) {
        dispatch(loginSuccess({ token: data.token, user: data.user }));
        dispatch(setAuthModalOpen(false));
      } else {
        throw new Error(data.message);
      }
    } catch {
      // Offline / Local mock fallback
      const guestId = `guest_${Date.now()}`;
      const guestUser = {
        id: guestId,
        username: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
        color: '#6366f1',
        isGuest: true
      };
      // Simple base64 fallback token for testing
      const fakeToken = btoa(JSON.stringify(guestUser));
      dispatch(loginSuccess({ token: fakeToken, user: guestUser }));
      dispatch(setAuthModalOpen(false));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60
    }}>
      <div
        className="glass-panel animate-slide-down"
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          position: 'relative'
        }}
      >
        <button
          onClick={() => dispatch(setAuthModalOpen(false))}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            color: 'var(--text-muted)'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Collaborate in real-time with your team
          </p>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger)',
            fontSize: 12,
            marginBottom: 16,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Username
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px'
              }}>
                <User size={15} color="var(--text-dim)" />
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{ background: 'none', border: 'none', color: '#fff', width: '100%', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Email Address
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px'
            }}>
              <Mail size={15} color="var(--text-dim)" />
              <input
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ background: 'none', border: 'none', color: '#fff', width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px'
            }}>
              <Lock size={15} color="var(--text-dim)" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ background: 'none', border: 'none', color: '#fff', width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* 1-Click Guest Button */}
        <button
          onClick={handleGuestLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Sparkles size={15} color="#06b6d4" />
          <span>Continue Instantly as Guest</span>
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{
              background: 'none',
              color: 'var(--text-muted)',
              fontSize: 12
            }}
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
