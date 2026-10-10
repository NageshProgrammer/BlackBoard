import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { CanvasBoard } from './components/CanvasBoard';
import { UserPresence } from './components/UserPresence';
import { MiniMap } from './components/MiniMap';
import { MetricsOverlay } from './components/MetricsOverlay';
import { AuthModal } from './components/AuthModal';
import { RoomModal } from './components/RoomModal';
import { useSocket } from './hooks/useSocket';
import { loginSuccess } from './store/authSlice';
import { clearAllElements } from './store/canvasSlice';

export function App() {
  const dispatch = useDispatch();
  const canvasRef = useRef(null);

  const token = useSelector((state) => state.auth.token);
  const currentRoom = useSelector((state) => state.room.currentRoom);

  // Auto-generate guest login if user hasn't authenticated yet
  useEffect(() => {
    if (!token) {
      const guestId = `guest_${Math.floor(1000 + Math.random() * 9000)}`;
      const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#06B6D4'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const guestUser = {
        id: guestId,
        username: `Guest_${guestId.slice(-4)}`,
        color,
        isGuest: true
      };
      const dummyToken = btoa(JSON.stringify(guestUser));
      dispatch(loginSuccess({ token: dummyToken, user: guestUser }));
    }
  }, [token, dispatch]);

  // Sync Room with URL hash if present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== currentRoom.roomId) {
      window.location.hash = currentRoom.roomId;
    }
  }, [currentRoom.roomId]);

  // WebSocket Collaborative Hook
  const {
    emitElementUpdate,
    emitElementDelete,
    emitCursorMove,
    emitUndo,
    emitRedo,
    emitClearCanvas
  } = useSocket(currentRoom.roomId, token);

  // Global Undo / Redo Keyboard Shortcuts
  useEffect(() => {
    const handleUndoRedo = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          emitRedo();
        } else {
          e.preventDefault();
          emitUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        emitRedo();
      }
    };

    window.addEventListener('keydown', handleUndoRedo);
    return () => window.removeEventListener('keydown', handleUndoRedo);
  }, [emitUndo, emitRedo]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire whiteboard?')) {
      dispatch(clearAllElements());
      emitClearCanvas();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navigation */}
      <Navbar onClearCanvas={handleClear} canvasRef={canvasRef} />

      {/* Main Interactive Drawing Canvas */}
      <CanvasBoard
        canvasRef={canvasRef}
        emitElementUpdate={emitElementUpdate}
        emitElementDelete={emitElementDelete}
        emitCursorMove={emitCursorMove}
      />

      {/* Multiplayer Real-Time Cursors */}
      <UserPresence />

      {/* Floating Bottom Toolbar */}
      <Toolbar onUndo={emitUndo} onRedo={emitRedo} />

      {/* Bottom Right Minimap & Zoom */}
      <MiniMap />

      {/* Diagnostics & Conflict Resolution Banner */}
      <MetricsOverlay />

      {/* Modals */}
      <AuthModal />
      <RoomModal />
    </div>
  );
}

export default App;
