'use client';

interface StatusBadgeProps {
  status: 'active' | 'expired' | 'exhausted' | 'disabled' | 'locked' | 'pending';
  text?: string;
}

const statusConfig = {
  active: { class: 'status-active', label: '正常' },
  expired: { class: 'status-expired', label: '已超时' },
  exhausted: { class: 'status-exhausted', label: '次数已用完' },
  disabled: { class: 'status-disabled', label: '已禁用' },
  locked: { class: 'status-locked', label: '已锁定' },
  pending: { class: 'status-exhausted', label: '待处理' },
};

export function StatusBadge({ status, text }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.active;
  
  return (
    <span className={`status-badge ${config.class}`}>
      {text || config.label}
    </span>
  );
}
