import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Plus, LogIn, Lock, Globe } from 'lucide-react';
import { setCurrentRoom, setRoomModalOpen } from '../store/roomSlice';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '3000' ? 'http://localhost:5000' : '');

export const RoomModal = () => {
  const dispatch = useDispatch();
  const isOpen = useSelector((state) => state.room.isRoomModalOpen);
  const token = useSelector((state) => state.auth.token);

  const [activeTab, setActiveTab] = useState('join'); // 'join' | 'create'
  const [roomToJoin, setRoomToJoin] = useState('');
  const [passcode, setPasscode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`);
      const data = await res.json();
      if (data.success && Array.isArray(data.rooms)) {
        setPublicRooms(data.rooms);
      }
    } catch {
      // Offline fallback
    }
  };

  if (!isOpen) return null;

  const handleJoin = (targetId = roomToJoin) => {
    if (!targetId.trim()) return;
    dispatch(setCurrentRoom({
      roomId: targetId.trim(),
      name: `Room ${targetId.trim()}`,
      isPrivate: Boolean(passcode)
    }));
    dispatch(setRoomModalOpen(false));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: newRoomName || 'Collaborative Whiteboard',
          isPrivate,
          passcode: isPrivate ? passcode : ''
        })
      });
      const data = await res.json();

      if (data.success && data.room) {
        dispatch(setCurrentRoom(data.room));
        dispatch(setRoomModalOpen(false));
      } else {
        setError(data.message || 'Failed to create room');
      }
    } catch {
      // Local fallback room creation
      const localId = Math.random().toString(36).substring(2, 9);
      dispatch(setCurrentRoom({
        roomId: localId,
        name: newRoomName || `Board ${localId}`,
        isPrivate
      }));
      dispatch(setRoomModalOpen(false));
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
          maxWidth: 440,
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          position: 'relative'
        }}
      >
        <button
          onClick={() => dispatch(setRoomModalOpen(false))}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          Manage Whiteboard Rooms
        </h2>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: 3,
          marginBottom: 16
        }}>
          <button
            onClick={() => setActiveTab('join')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'join' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'join' ? '#fff' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Join Existing Room
          </button>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'create' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'create' ? '#fff' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Create New Room
          </button>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger)',
            fontSize: 12,
            marginBottom: 12
          }}>
            {error}
          </div>
        )}

        {activeTab === 'join' ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Enter Room Code (e.g. board-123)"
                value={roomToJoin}
                onChange={(e) => setRoomToJoin(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: 13
                }}
              />
              <button
                onClick={() => handleJoin()}
                style={{
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <LogIn size={15} />
                Join
              </button>
            </div>

            {/* Public Rooms List */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Recent Public Rooms
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {publicRooms.length > 0 ? (
                  publicRooms.map((r) => (
                    <div
                      key={r.roomId}
                      onClick={() => handleJoin(r.roomId)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          ID: {r.roomId}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--accent-secondary)' }}>
                        {r.elementCount || 0} elements
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                    No public rooms found. Create one to get started!
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Room Title
              </label>
              <input
                type="text"
                placeholder="e.g. Sprint Architecture Whiteboard"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <input
                type="checkbox"
                id="isPrivateCheck"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="isPrivateCheck" style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Make Private (Requires Passcode)
              </label>
            </div>

            {isPrivate && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Room Passcode
                </label>
                <input
                  type="password"
                  placeholder="Secret passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required={isPrivate}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: 13
                  }}
                />
              </div>
            )}

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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Plus size={16} />
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
