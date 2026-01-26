import { forwardRef, type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold rounded-lg
      transition-colors duration-200
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variantStyles = {
      primary: 'bg-yellow-400 text-black hover:bg-yellow-500',
      outline: 'bg-transparent border border-black text-black hover:bg-gray-100',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-black',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-base',
    };

    const widthStyles = fullWidth ? 'w-full' : '';

    const combinedStyles = [
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      widthStyles,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={combinedStyles}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
