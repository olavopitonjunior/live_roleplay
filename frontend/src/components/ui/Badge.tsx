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
    primary: 'bg-yellow-400 text-black border-black',
    secondary: 'bg-white text-black border-black',
    success: 'bg-green-100 text-black border-black',
    warning: 'bg-yellow-100 text-black border-black',
    error: 'bg-red-100 text-black border-black',
    info: 'bg-blue-50 text-black border-black',
    neutral: 'bg-gray-100 text-black border-black',
    accent: 'bg-yellow-400 text-black border-black',
  };

  const dotStyles = {
    primary: 'bg-yellow-500',
    secondary: 'bg-gray-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-500',
    accent: 'bg-yellow-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
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
      className={`inline-flex items-center font-bold border-2 uppercase tracking-wider
                  ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={{ fontFamily: "'Space Mono', monospace" }}
      {...props}
    >
      {dot && (
        <span className={`${dotStyles[variant]} ${dotSizeStyles[size]}`} />
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
          className="flex-shrink-0 -mr-1 ml-0.5 p-0.5 hover:bg-black/10 transition-colors"
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

// Status Badge
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

// Counter Badge
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
                  text-xs font-bold border-2 border-black
                  ${variant === 'primary' ? 'bg-yellow-400 text-black' :
                    variant === 'error' ? 'bg-red-500 text-white' :
                    'bg-gray-100 text-black'} ${className}`}
      style={{ fontFamily: "'Space Mono', monospace" }}
    >
      {displayCount}
    </span>
  );
}

// Badge Group
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

// Score Badge
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
