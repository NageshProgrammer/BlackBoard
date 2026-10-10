import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import {
  setElements,
  upsertElement,
  removeElement,
  setActiveUsers,
  updatePeerCursor,
  removePeerCursor,
  setConnectionStatus,
  setLatency,
  setOfflineStatus,
  setConflictResolvedNotice
} from '../store/canvasSlice';
import { saveRoomCache, loadRoomCache } from '../utils/storage';

const WS_URL = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' && window.location.port === '3000' ? 'http://localhost:5000' : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

export const useSocket = (roomId, token) => {
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const elements = useSelector((state) => state.canvas.elements);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // Initialize Socket connection
  useEffect(() => {
    if (!token || !roomId) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch(setConnectionStatus(true));
      dispatch(setOfflineStatus(false));

      // Join room
      socket.emit('join-room', { roomId }, (response) => {
        if (response && response.success) {
          if (Array.isArray(response.elements) && response.elements.length > 0) {
            dispatch(setElements(response.elements));
            saveRoomCache(roomId, response.elements);
          } else {
            // Check if local cache has offline drawings to restore
            const cached = loadRoomCache(roomId);
            if (cached && Array.isArray(cached.elements)) {
              dispatch(setElements(cached.elements));
            }
          }

          if (Array.isArray(response.users)) {
            dispatch(setActiveUsers(response.users));
          }
        }
      });
    });

    socket.on('disconnect', () => {
      dispatch(setConnectionStatus(false));
    });

    socket.on('connect_error', () => {
      dispatch(setConnectionStatus(false));
    });

    // Remote element sync (OT transformed by server)
    socket.on('element-synced', ({ element, conflictResolved }) => {
      dispatch(upsertElement(element));
      if (conflictResolved) {
        dispatch(setConflictResolvedNotice(`Resolved concurrent update on ${element.type}`));
        setTimeout(() => dispatch(setConflictResolvedNotice(null)), 3000);
      }
    });

    // Remote element deleted
    socket.on('element-deleted', ({ elementId }) => {
      dispatch(removeElement(elementId));
    });

    // Canvas cleared
    socket.on('canvas-cleared', () => {
      dispatch(setElements([]));
    });

    // Peer user joined
    socket.on('user-joined', ({ users }) => {
      if (Array.isArray(users)) {
        dispatch(setActiveUsers(users));
      }
    });

    // Peer user left
    socket.on('user-left', ({ userId, users }) => {
      if (userId) dispatch(removePeerCursor(userId));
      if (Array.isArray(users)) dispatch(setActiveUsers(users));
    });

    // Real-time peer cursors
    socket.on('cursor-update', (cursorData) => {
      dispatch(updatePeerCursor(cursorData));
    });

    // Heartbeat ping-pong every 30s as required by prompt
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('heartbeat', { timestamp: start }, (res) => {
          if (res && res.status === 'pong') {
            const rtt = Date.now() - start;
            dispatch(setLatency(rtt));
          }
        });
      }
    }, 15000); // 15-30s intervals

    // Handle online/offline browser state
    const handleOnline = () => {
      dispatch(setOfflineStatus(false));
      if (!socket.connected) socket.connect();
    };

    const handleOffline = () => {
      dispatch(setOfflineStatus(true));
      dispatch(setConnectionStatus(false));
      // Save snapshot of current elements locally
      saveRoomCache(roomId, Object.values(elementsRef.current));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      socket.disconnect();
    };
  }, [roomId, token, dispatch]);

  // Emit draw or element update
  const emitElementUpdate = useCallback((element, isNew = false, previousData = null) => {
    if (!socketRef.current || !socketRef.current.connected) {
      // Offline fallback: save locally
      saveRoomCache(roomId, Object.values({ ...elementsRef.current, [element.id]: element }));
      return;
    }

    socketRef.current.emit(
      'draw-stroke',
      {
        type: 'element-update',
        action: 'UPDATE',
        element,
        isNew,
        previousData,
        baseVersion: element.version || 1,
        timestamp: Date.now()
      },
      (ack) => {
        if (ack && ack.conflictResolved) {
          dispatch(setConflictResolvedNotice('Conflict resolved and synced'));
          setTimeout(() => dispatch(setConflictResolvedNotice(null)), 2500);
        }
      }
    );
  }, [roomId, dispatch]);

  // Emit element delete
  const emitElementDelete = useCallback((elementId) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('element-delete', { elementId });
  }, []);

  // Emit local cursor position
  const emitCursorMove = useCallback((x, y) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('cursor-move', { x, y });
  }, []);

  // Emit per-user undo
  const emitUndo = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('undo');
  }, []);

  // Emit per-user redo
  const emitRedo = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('redo');
  }, []);

  // Emit clear canvas
  const emitClearCanvas = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('clear-canvas');
  }, []);

  return {
    socket: socketRef.current,
    emitElementUpdate,
    emitElementDelete,
    emitCursorMove,
    emitUndo,
    emitRedo,
    emitClearCanvas
  };
};
