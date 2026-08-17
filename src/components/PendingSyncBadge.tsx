'use client';

import { useOfflineSync, SyncStatus } from '@/lib/useOfflineSync';

const STATUS_CONFIG: Record<SyncStatus, { label: string; icon: string; color: string; pulse: boolean }> = {
  synced: {
    label: 'Synced',
    icon: '✓',
    color: 'bg-green-100 text-green-700 border-green-200',
    pulse: false,
  },
  pending: {
    label: 'Pending Sync',
    icon: '⏳',
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    pulse: true,
  },
  syncing: {
    label: 'Syncing...',
    icon: '🔄',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    pulse: true,
  },
  error: {
    label: 'Sync Error',
    icon: '⚠️',
    color: 'bg-red-100 text-red-700 border-red-200',
    pulse: false,
  },
};

interface PendingSyncBadgeProps {
  /** Show only when there are pending writes (default: true) */
  showOnlySyncing?: boolean;
  /** Compact mode — icon only */
  compact?: boolean;
  className?: string;
}

export default function PendingSyncBadge({
  showOnlySyncing = true,
  compact = false,
  className = '',
}: PendingSyncBadgeProps) {
  const { status, pendingCount } = useOfflineSync();

  // Hide if synced and showOnlySyncing is true
  if (showOnlySyncing && status === 'synced') {
    return null;
  }

  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold ${config.color} ${config.pulse ? 'animate-pulse' : ''} ${className}`}
        title={`${config.label}${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
      >
        {pendingCount > 0 ? pendingCount : config.icon}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${config.color} ${config.pulse ? 'animate-pulse' : ''} ${className}`}
    >
      <span className="text-sm">{config.icon}</span>
      <span>{config.label}</span>
      {pendingCount > 0 && (
        <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
          {pendingCount}
        </span>
      )}
    </div>
  );
}
