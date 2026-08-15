import React from 'react';
import { Lightbulb, ArrowRight, ShieldAlert, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

export interface RecommendedActionCardProps {
  title: string;
  subtitle: string;
  metricLabel?: string;
  metricValue?: string;
  recommendedAction: string;
  buttonText?: string;
  onActionClick?: () => void;
  type?: 'warning' | 'info' | 'success' | 'danger';
}

export const RecommendedActionCard: React.FC<RecommendedActionCardProps> = ({
  title,
  subtitle,
  metricLabel,
  metricValue,
  recommendedAction,
  buttonText,
  onActionClick,
  type = 'warning'
}) => {
  const getBadgeStyle = () => {
    switch (type) {
      case 'danger':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#FCA5A5', icon: ShieldAlert };
      case 'success':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#6EE7B7', icon: TrendingUp };
      case 'info':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#93C5FD', icon: Sparkles };
      case 'warning':
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#FCD34D', icon: AlertTriangle };
    }
  };

  const badge = getBadgeStyle();
  const Icon = badge.icon;

  return (
    <div
      className="glass-card"
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
        border: '1px solid rgba(129, 140, 248, 0.25)',
        borderRadius: '12px',
        padding: '20px 24px',
        margin: '20px 0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#818CF8' }}>
              💡 Recommended Action
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
              {title}
            </h3>
          </div>
        </div>

        {metricValue && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: badge.bg, border: `1px solid ${badge.border}` }}>
            <Icon size={16} color={badge.text} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC' }}>
              {metricLabel ? `${metricLabel}: ` : ''}<strong style={{ color: badge.text }}>{metricValue}</strong>
            </span>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.5 }}>
        {subtitle}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E2E8F0', fontSize: '0.9rem', fontWeight: 500 }}>
          <strong style={{ color: '#818CF8' }}>Strategy:</strong> {recommendedAction}
        </div>

        {buttonText && onActionClick && (
          <button
            onClick={onActionClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{buttonText}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
