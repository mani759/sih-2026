import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { RiskSeverity } from '../types';

interface RiskBadgeProps {
  score?: number;
  severity?: RiskSeverity | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  severity,
  size = 'md',
  showIcon = true
}) => {
  // Normalize severity
  let effectiveSeverity: RiskSeverity = 'low';
  if (severity) {
    effectiveSeverity = severity.toLowerCase() as RiskSeverity;
  } else if (score !== undefined) {
    if (score >= 70) effectiveSeverity = 'high';
    else if (score >= 45) effectiveSeverity = 'medium';
    else effectiveSeverity = 'low';
  }

  const styles = {
    high: {
      bg: 'bg-red-50',
      border: 'border-[#F04438]',
      text: 'text-[#D92D20]',
      label: 'High Risk',
      icon: AlertTriangle
    },
    medium: {
      bg: 'bg-amber-50',
      border: 'border-[#F79009]',
      text: 'text-[#B54708]',
      label: 'Medium Risk',
      icon: AlertCircle
    },
    low: {
      bg: 'bg-emerald-50',
      border: 'border-[#12B76A]',
      text: 'text-[#027A48]',
      label: 'Low Risk',
      icon: CheckCircle2
    }
  };

  const current = styles[effectiveSeverity] || styles.low;
  const IconComponent = current.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-1 space-x-1.5',
    lg: 'text-sm px-3 py-1.5 space-x-2'
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border ${current.bg} ${current.border} ${current.text} ${sizeClasses} whitespace-nowrap`}
    >
      {showIcon && <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{current.label}</span>
      {score !== undefined && (
        <span className="font-mono ml-0.5 opacity-90">({score}%)</span>
      )}
    </span>
  );
};
