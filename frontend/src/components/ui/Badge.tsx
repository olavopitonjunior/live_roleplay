import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'accent';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  removable = false,
  onRemove,
  children,
  className = '',
  ...props
}: BadgeProps) {
  const variantStyles = {
    primary: 'bg-primary-100 text-primary-700 border-primary-200',
    secondary: 'bg-secondary-100 text-secondary-700 border-secondary-200',
    success: 'bg-success-100 text-success-700 border-success-200',
    warning: 'bg-warning-100 text-warning-700 border-warning-200',
    error: 'bg-error-100 text-error-700 border-error-200',
    info: 'bg-info-100 text-info-700 border-info-200',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    accent: 'bg-accent-100 text-accent-700 border-accent-200',
  };

  const dotStyles = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
    info: 'bg-info-500',
    neutral: 'bg-neutral-500',
    accent: 'bg-accent-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const dotSizeStyles = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const iconSizeStyles = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border
                  ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`rounded-full ${dotStyles[variant]} ${dotSizeStyles[size]}`} />
      )}
      {icon && !dot && (
        <span className={`flex-shrink-0 ${iconSizeStyles[size]}`}>{icon}</span>
      )}
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="flex-shrink-0 -mr-1 ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Remover"
        >
          <svg className={iconSizeStyles[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

// Status Badge - common pattern for status indicators
export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'error' | 'warning';
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'Ativo', dot: true },
    inactive: { variant: 'neutral' as const, label: 'Inativo', dot: true },
    pending: { variant: 'warning' as const, label: 'Pendente', dot: true },
    completed: { variant: 'success' as const, label: 'Concluido', dot: false },
    error: { variant: 'error' as const, label: 'Erro', dot: true },
    warning: { variant: 'warning' as const, label: 'Atencao', dot: true },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
}

// Counter Badge - for notification counts
export interface CounterBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  className?: string;
}

export function CounterBadge({
  count,
  max = 99,
  variant = 'primary',
  className = '',
}: CounterBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();

  if (count === 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                  text-xs font-bold rounded-full
                  ${variant === 'primary' ? 'bg-primary-500 text-white' :
                    variant === 'secondary' ? 'bg-secondary-500 text-white' :
                    variant === 'error' ? 'bg-error-500 text-white' :
                    'bg-neutral-500 text-white'} ${className}`}
    >
      {displayCount}
    </span>
  );
}

// Badge Group - for displaying multiple badges
export interface BadgeGroupProps {
  children: ReactNode;
  className?: string;
}

export function BadgeGroup({ children, className = '' }: BadgeGroupProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
}

// Score Badge - for displaying scores with color coding
export interface ScoreBadgeProps {
  score: number;
  size?: BadgeSize;
  showLabel?: boolean;
  className?: string;
}

export function ScoreBadge({
  score,
  size = 'md',
  showLabel = false,
  className = '',
}: ScoreBadgeProps) {
  const getVariant = (): BadgeVariant => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getLabel = (): string => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    return 'Precisa melhorar';
  };

  return (
    <Badge variant={getVariant()} size={size} className={className}>
      {score}
      {showLabel && <span className="ml-1 opacity-80">- {getLabel()}</span>}
    </Badge>
  );
}
