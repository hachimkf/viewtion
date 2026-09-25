import React from 'react';

export const tokens = {
  colors: {
    bgApp: '#0D0D10',
    bgPanel: '#141418',
    bgCard: '#1C1C22',
    bgCardHover: '#25252E',
    bgInput: '#18181F',
    border: '#26262E',
    borderLight: '#32323D',
    accentLime: '#E2F952',
    accentLimeHover: '#D4F63D',
    accentPurple: '#9D7BFF',
    accentCyan: '#38BDF8',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    full: '9999px',
  },
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    monoFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'lime-pill';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: tokens.typography.fontFamily,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s ease',
    outline: 'none',
    userSelect: 'none',
    ...style,
  };

  if (variant === 'lime-pill') {
    Object.assign(baseStyle, {
      backgroundColor: tokens.colors.accentLime,
      color: '#0D0D10',
      borderRadius: tokens.radius.full,
      fontWeight: 600,
      padding: size === 'sm' ? '4px 12px' : '8px 18px',
      fontSize: size === 'sm' ? '12px' : '14px',
    });
  } else if (variant === 'primary') {
    Object.assign(baseStyle, {
      backgroundColor: tokens.colors.accentLime,
      color: '#0D0D10',
      borderRadius: tokens.radius.md,
      padding: '8px 16px',
      fontSize: '13px',
      fontWeight: 600,
    });
  } else if (variant === 'secondary') {
    Object.assign(baseStyle, {
      backgroundColor: tokens.colors.bgCard,
      color: tokens.colors.textPrimary,
      border: `1px solid ${tokens.colors.border}`,
      borderRadius: tokens.radius.md,
      padding: '6px 12px',
      fontSize: '13px',
    });
  } else if (variant === 'ghost') {
    Object.assign(baseStyle, {
      backgroundColor: 'transparent',
      color: tokens.colors.textSecondary,
      borderRadius: tokens.radius.sm,
      padding: '6px',
      fontSize: '13px',
    });
  }

  return (
    <button style={baseStyle} className={className} {...props}>
      {icon}
      {children}
    </button>
  );
};
