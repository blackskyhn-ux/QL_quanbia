'use client';

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              isSuccess
                ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                : isError
                ? 'bg-slate-900/95 text-rose-300 border-rose-500/40 shadow-rose-500/10'
                : isWarning
                ? 'bg-slate-900/95 text-amber-300 border-amber-500/40 shadow-amber-500/10'
                : 'bg-slate-900/95 text-sky-300 border-sky-500/40 shadow-sky-500/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {isError && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
              <span className="text-xs font-semibold leading-tight text-white">{toast.message}</span>
            </div>

            <button
              onClick={() => onClose(toast.id)}
              className="text-slate-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
