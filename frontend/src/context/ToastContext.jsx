import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastSuccess = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast]);
  const toastError = useCallback((msg, duration) => addToast(msg, 'error', duration), [addToast]);
  const toastInfo = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast]);
  const toastWarning = useCallback((msg, duration) => addToast(msg, 'warning', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toastSuccess, toastError, toastInfo, toastWarning }}>
      {children}
      {/* Toast Container - Mobile bottom, desktop top-right */}
      <div className="fixed z-50 pointer-events-none flex flex-col gap-2 p-4 bottom-4 left-4 right-4 sm:bottom-auto sm:left-auto sm:top-20 sm:right-6 sm:w-96 sm:max-w-md">
        {toasts.map((toast) => {
          let bgClass = 'bg-navy-900 border-navy-700 text-slate-100';
          let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-950/90 border-emerald-600/50 text-emerald-100 shadow-lg shadow-emerald-950/40';
            icon = <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'error') {
            bgClass = 'bg-red-950/90 border-red-600/50 text-red-100 shadow-lg shadow-red-950/40';
            icon = <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgClass = 'bg-amber-950/90 border-amber-600/50 text-amber-100 shadow-lg shadow-amber-950/40';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 animate-slide-in ${bgClass}`}
            >
              <div className="flex items-start gap-2.5">
                {icon}
                <div className="text-xs sm:text-sm font-medium leading-relaxed">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 -mr-1 -mt-1 rounded-lg transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
