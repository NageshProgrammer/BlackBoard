import React from 'react';
import { useSelector } from 'react-redux';
import { ShieldCheck, Cpu } from 'lucide-react';

export const MetricsOverlay = () => {
  const lastConflictResolved = useSelector((state) => state.canvas.lastConflictResolved);

  return (
    <>
      {/* OT Conflict Resolution Toast Banner */}
      {lastConflictResolved && (
        <div
          className="glass-panel animate-slide-down"
          style={{
            position: 'fixed',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.25)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            color: '#a5b4fc',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 45,
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          <ShieldCheck size={16} color="#818cf8" />
          <span>OT Engine: {lastConflictResolved}</span>
        </div>
      )}

      {/* Subtle Bottom Left System Health Pill */}
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          borderRadius: 'var(--radius-md)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 40,
          fontSize: 11,
          color: 'var(--text-muted)'
        }}
      >
        <Cpu size={13} color="var(--accent-secondary)" />
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>BoardCollab</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>OT State Engine Active</span>
      </div>
    </>
  );
};
