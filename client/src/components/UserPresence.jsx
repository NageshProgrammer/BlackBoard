import React from 'react';
import { useSelector } from 'react-redux';

export const UserPresence = () => {
  const peerCursors = useSelector((state) => state.canvas.peerCursors);
  const viewport = useSelector((state) => state.canvas.viewport);

  const cursors = Object.entries(peerCursors);

  if (cursors.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 30 }}>
      {cursors.map(([userId, cursor]) => {
        // Transform canvas coordinate to screen coordinate via zoom and pan
        const screenX = cursor.x * viewport.zoom + viewport.panX;
        const screenY = cursor.y * viewport.zoom + viewport.panY;

        return (
          <div
            key={userId}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
              transition: 'left 0.08s linear, top 0.08s linear',
              pointerEvents: 'none',
              zIndex: 35
            }}
          >
            {/* SVG Cursor Pointer Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={cursor.color || '#3b82f6'}
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" />
            </svg>

            {/* Nametag Pill */}
            <div
              style={{
                marginLeft: 16,
                marginTop: -4,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: cursor.color || '#3b82f6',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {cursor.username || 'Collaborator'}
            </div>
          </div>
        );
      })}
    </div>
  );
};
