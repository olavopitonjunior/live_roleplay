import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      fullWidth = true,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const baseInputStyles =
      'w-full px-4 py-3 bg-white border-2 border-black text-black placeholder:text-gray-400 focus:ring-2 focus:ring-yellow-400 focus:ring-offset-0 outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100';

    const errorStyles = error ? 'border-red-500' : '';

    const combinedInputStyles = [baseInputStyles, errorStyles, className]
      .filter(Boolean)
      .join(' ');

    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <div className={widthStyles}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          className={combinedInputStyles}
          style={{ fontFamily: "'Space Mono', monospace" }}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} className="mt-2 text-sm text-red-500 font-bold">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-2 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = true, className = '', id, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const baseStyles =
      'w-full px-4 py-3 bg-white border-2 border-black text-black placeholder:text-gray-400 focus:ring-2 focus:ring-yellow-400 focus:ring-offset-0 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100';

    const errorStyles = error ? 'border-red-500' : '';

    const combinedStyles = [baseStyles, errorStyles, className]
      .filter(Boolean)
      .join(' ');

    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <div className={widthStyles}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          className={combinedStyles}
          style={{ fontFamily: "'Space Mono', monospace" }}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} className="mt-2 text-sm text-red-500 font-bold">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-2 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
