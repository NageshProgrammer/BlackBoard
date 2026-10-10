import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  MousePointer,
  Pencil,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Type,
  Undo2,
  Redo2,
  Palette
} from 'lucide-react';
import { setActiveTool, updateToolSettings } from '../store/canvasSlice';

const PALETTE = [
  '#6366f1', // Indigo / Brand
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#ffffff', // White
  '#94a3b8'  // Slate
];

export const Toolbar = ({ onUndo, onRedo }) => {
  const dispatch = useDispatch();
  const activeTool = useSelector((state) => state.canvas.activeTool);
  const toolSettings = useSelector((state) => state.canvas.toolSettings);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools = [
    { id: 'select', label: 'Select (V)', icon: MousePointer },
    { id: 'pencil', label: 'Draw (P)', icon: Pencil },
    { id: 'rectangle', label: 'Rectangle (R)', icon: Square },
    { id: 'circle', label: 'Circle (O)', icon: Circle },
    { id: 'line', label: 'Line (L)', icon: Minus },
    { id: 'arrow', label: 'Arrow (A)', icon: MoveUpRight },
    { id: 'text', label: 'Text (T)', icon: Type },
    { id: 'eraser', label: 'Eraser (E)', icon: Eraser }
  ];

  return (
    <div
      className="glass-toolbar animate-fade-in"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 'var(--radius-lg)',
        zIndex: 40
      }}
    >
      {/* Undo & Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 6, borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Undo2 size={16} />
        </button>

        <button
          onClick={onRedo}
          title="Redo (Ctrl+Y)"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Main Drawing Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => dispatch(setActiveTool(t.id))}
              title={t.label}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Tool Properties Separator */}
      <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

      {/* Color Picker Toggle */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Stroke Color"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: toolSettings.strokeColor,
              border: '2px solid rgba(255, 255, 255, 0.8)',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)'
            }}
          />
          <Palette size={14} color="var(--text-muted)" />
        </button>

        {showColorPicker && (
          <div
            className="glass-panel animate-slide-down"
            style={{
              position: 'absolute',
              bottom: '125%',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minWidth: 180,
              zIndex: 50
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Stroke Color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PALETTE.map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    dispatch(updateToolSettings({ strokeColor: c }));
                    setShowColorPicker(false);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: c,
                    cursor: 'pointer',
                    border: toolSettings.strokeColor === c ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: toolSettings.strokeColor === c ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                    transition: 'transform 0.1s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>

            {/* Custom Hex Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <input
                type="color"
                value={toolSettings.strokeColor}
                onChange={(e) => dispatch(updateToolSettings({ strokeColor: e.target.value }))}
                style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {toolSettings.strokeColor}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stroke Width Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
        {[2, 4, 8].map((w) => (
          <button
            key={w}
            onClick={() => dispatch(updateToolSettings({ strokeWidth: w }))}
            title={`${w}px Stroke`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              background: toolSettings.strokeWidth === w ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: 14,
                height: w,
                borderRadius: 99,
                backgroundColor: toolSettings.strokeWidth === w ? '#fff' : 'var(--text-muted)'
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
