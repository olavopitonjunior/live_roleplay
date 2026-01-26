import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  };

  const baseHeight = variant === 'text' ? '1em' : undefined;

  return (
    <div
      className={`bg-neutral-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? baseHeight,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

// Preset skeleton components for common patterns
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '75%' : '100%'}
          height={16}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <Skeleton
      variant="circular"
      width={sizeMap[size]}
      height={sizeMap[size]}
      className={className}
    />
  );
}

export function SkeletonButton({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeStyles = {
    sm: { width: 80, height: 32 },
    md: { width: 120, height: 40 },
    lg: { width: 160, height: 48 },
  };

  return (
    <Skeleton
      variant="rounded"
      width={sizeStyles[size].width}
      height={sizeStyles[size].height}
      className={className}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border border-neutral-100 ${className}`}>
      <div className="flex gap-4">
        <Skeleton variant="rounded" width={56} height={56} />
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="80%" height={16} />
          <div className="flex gap-2">
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({
  count = 3,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-neutral-200 ${className}`}>
      {/* Header */}
      <div className="bg-neutral-100 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={16} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-4 py-3 flex gap-4 border-t border-neutral-100"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              width={`${100 / columns}%`}
              height={16}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stats skeleton
export function SkeletonStats({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-neutral-200 to-neutral-300 rounded-2xl p-6 animate-pulse ${className}`}>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton variant="text" width={60} height={40} className="bg-neutral-300 mb-2" />
            <Skeleton variant="text" width={50} height={14} className="bg-neutral-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Score circle skeleton
export function SkeletonScoreCircle({
  size = 160,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Skeleton variant="circular" width={size} height={size} />
      <Skeleton variant="text" width={100} height={24} className="mt-4" />
      <Skeleton variant="text" width={80} height={16} className="mt-2" />
    </div>
  );
}
