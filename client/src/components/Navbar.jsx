import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Share2,
  Download,
  Trash2,
  Wifi,
  WifiOff,
  User,
  LogOut,
  FolderPlus,
  Activity,
  Check
} from 'lucide-react';
import { logout } from '../store/authSlice';
import { setAuthModalOpen, setRoomModalOpen } from '../store/roomSlice';
import { exportCanvasAsPNG, exportCanvasAsSVG, exportCanvasAsJSON } from '../utils/exportUtils';

export const Navbar = ({ onClearCanvas, canvasRef }) => {
  const dispatch = useDispatch();
  const currentRoom = useSelector((state) => state.room.currentRoom);
  const activeUsers = useSelector((state) => state.canvas.activeUsers);
  const isConnected = useSelector((state) => state.canvas.isConnected);
  const isOffline = useSelector((state) => state.canvas.isOffline);
  const latency = useSelector((state) => state.canvas.latency);
  const user = useSelector((state) => state.auth.user);
  const elements = useSelector((state) => state.canvas.elements);

  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    if (format === 'png') {
      exportCanvasAsPNG(canvasRef?.current, currentRoom.name);
    } else if (format === 'svg') {
      exportCanvasAsSVG(elements, currentRoom.name);
    } else if (format === 'json') {
      exportCanvasAsJSON(elements, currentRoom.name);
    }
  };

  return (
    <header className="navbar glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      position: 'fixed',
      top: 12,
      left: 16,
      right: 16,
      zIndex: 40,
      borderRadius: 'var(--radius-lg)'
    }}>
      {/* Brand & Room Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="navbar-title" style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>
              BoardCollab
            </span>
            <span className="navbar-room-badge" style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              ROOM: {currentRoom.roomId}
            </span>
          </div>
          <div className="navbar-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {currentRoom.name}
          </div>
        </div>

        <button
          onClick={() => dispatch(setRoomModalOpen(true))}
          title="Switch / Create Room"
          style={{
            marginLeft: 8,
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12
          }}
        >
          <FolderPlus size={14} />
          <span className="navbar-btn-text">Rooms</span>
        </button>
      </div>

      {/* Middle: Connection Status & Latency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="navbar-status-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: isOffline ? 'rgba(239, 68, 68, 0.15)' : (isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
          border: `1px solid ${isOffline ? 'rgba(239, 68, 68, 0.3)' : (isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)')}`,
          fontSize: 12,
          fontWeight: 500,
          color: isOffline ? 'var(--danger)' : (isConnected ? 'var(--success)' : 'var(--warning)')
        }}>
          {isOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
          <span>{isOffline ? 'Offline' : (isConnected ? 'Live' : 'Connecting...')}</span>
        </div>

        {isConnected && (
          <div className="navbar-latency" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)'
          }}>
            <Activity size={12} color="#06b6d4" />
            <span>{latency > 0 ? `${latency}ms` : '<10ms'}</span>
          </div>
        )}
      </div>

      {/* Right Side: Active Users, Share, Export & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Active Collaborators Avatar Cluster */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {activeUsers.slice(0, 4).map((u, i) => (
            <div
              key={u.socketId || i}
              title={`${u.username} ${u.userId === user?.id ? '(You)' : ''}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: u.color || '#3b82f6',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-primary)',
                marginLeft: i > 0 ? -8 : 0,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {(u.username || 'U')[0].toUpperCase()}
            </div>
          ))}
          {activeUsers.length > 4 && (
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#374151',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)',
              marginLeft: -8
            }}>
              +{activeUsers.length - 4}
            </div>
          )}
        </div>

        {/* Share Button */}
        <button
          onClick={handleCopyLink}
          style={{
            padding: '7px 12px',
            borderRadius: 'var(--radius-md)',
            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            color: copied ? 'var(--success)' : '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />}
          <span className="navbar-btn-text">{copied ? 'Copied!' : 'Share'}</span>
        </button>

        {/* Export Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Download size={14} />
            <span className="navbar-btn-text">Export</span>
          </button>

          {showExportMenu && (
            <div className="glass-panel animate-slide-down" style={{
              position: 'absolute',
              top: '115%',
              right: 0,
              minWidth: 140,
              borderRadius: 'var(--radius-md)',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 50
            }}>
              <button
                onClick={() => handleExport('png')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  fontSize: 12
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Download PNG
              </button>
              <button
                onClick={() => handleExport('svg')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  fontSize: 12
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Download SVG
              </button>
              <button
                onClick={() => handleExport('json')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  textAlign: 'left',
                  fontSize: 12
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Download JSON
              </button>
            </div>
          )}
        </div>

        {/* Clear Canvas */}
        <button
          onClick={onClearCanvas}
          title="Clear Board"
          style={{
            padding: 7,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}
        >
          <Trash2 size={15} />
        </button>

        {/* User Account / Auth */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              fontSize: 12,
              color: 'var(--text-main)',
              fontWeight: 600,
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {user.username}
            </div>
            <button
              onClick={() => dispatch(logout())}
              title="Sign Out"
              style={{
                padding: 6,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)'
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => dispatch(setAuthModalOpen(true))}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <User size={13} />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
