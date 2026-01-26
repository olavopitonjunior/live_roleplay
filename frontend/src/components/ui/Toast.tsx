import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Helper functions for quick toasts
export function useToastHelpers() {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notificacoes"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>,
    document.body
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const typeStyles = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      icon: 'bg-gradient-to-br from-success-400 to-success-500',
      title: 'text-success-800',
      message: 'text-success-700',
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      icon: 'bg-gradient-to-br from-error-400 to-error-500',
      title: 'text-error-800',
      message: 'text-error-700',
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      icon: 'bg-gradient-to-br from-warning-400 to-warning-500',
      title: 'text-warning-800',
      message: 'text-warning-700',
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      icon: 'bg-gradient-to-br from-info-400 to-info-500',
      title: 'text-info-800',
      message: 'text-info-700',
    },
  };

  const styles = typeStyles[toast.type];

  const icons = {
    success: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`pointer-events-auto w-80 ${styles.bg} ${styles.border} border-2 rounded-xl
                  shadow-lg animate-slide-up p-4`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 ${styles.icon} rounded-lg
                         flex items-center justify-center shadow-sm`}>
          {icons[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${styles.title}`}>{toast.title}</p>
          {toast.message && (
            <p className={`mt-1 text-sm ${styles.message}`}>{toast.message}</p>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`flex-shrink-0 p-1 ${styles.message} hover:opacity-70 rounded transition-opacity`}
          aria-label="Fechar notificacao"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Standalone toast component for simple use cases
export interface StandaloneToastProps {
  type: ToastType;
  title: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export function StandaloneToast({ type, title, message, onClose, className = '' }: StandaloneToastProps) {
  const typeStyles = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      icon: 'bg-gradient-to-br from-success-400 to-success-500',
      title: 'text-success-800',
      message: 'text-success-700',
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      icon: 'bg-gradient-to-br from-error-400 to-error-500',
      title: 'text-error-800',
      message: 'text-error-700',
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      icon: 'bg-gradient-to-br from-warning-400 to-warning-500',
      title: 'text-warning-800',
      message: 'text-warning-700',
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      icon: 'bg-gradient-to-br from-info-400 to-info-500',
      title: 'text-info-800',
      message: 'text-info-700',
    },
  };

  const styles = typeStyles[type];

  const icons = {
    success: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`${styles.bg} ${styles.border} border-2 rounded-xl p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 ${styles.icon} rounded-lg
                         flex items-center justify-center shadow-sm`}>
          {icons[type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${styles.title}`}>{title}</p>
          {message && (
            <p className={`mt-1 text-sm ${styles.message}`}>{message}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`flex-shrink-0 p-1 ${styles.message} hover:opacity-70 rounded transition-opacity`}
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
