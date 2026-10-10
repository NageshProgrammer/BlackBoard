import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { zoomIn, zoomOut, resetZoom } from '../store/canvasSlice';

export const MiniMap = () => {
  const dispatch = useDispatch();
  const viewport = useSelector((state) => state.canvas.viewport);
  const elements = useSelector((state) => state.canvas.elements);

  const zoomPercent = Math.round(viewport.zoom * 100);
  const elementCount = Object.keys(elements).length;

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 40,
        boxShadow: 'var(--shadow-md)'
      }}
    >
      <button
        onClick={() => dispatch(zoomOut())}
        title="Zoom Out"
        style={{ padding: 4, borderRadius: 4, background: 'transparent', color: 'var(--text-muted)' }}
      >
        <ZoomOut size={15} />
      </button>

      <span
        onClick={() => dispatch(resetZoom())}
        title="Reset Zoom (100%)"
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-main)',
          minWidth: 42,
          textAlign: 'center',
          cursor: 'pointer'
        }}
      >
        {zoomPercent}%
      </span>

      <button
        onClick={() => dispatch(zoomIn())}
        title="Zoom In"
        style={{ padding: 4, borderRadius: 4, background: 'transparent', color: 'var(--text-muted)' }}
      >
        <ZoomIn size={15} />
      </button>

      <button
        onClick={() => dispatch(resetZoom())}
        title="Reset View"
        style={{ padding: 4, borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', marginLeft: 4 }}
      >
        <RotateCcw size={14} />
      </button>

      <div style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.1)', margin: '0 2px' }} />

      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {elementCount} items
      </span>
    </div>
  );
};
