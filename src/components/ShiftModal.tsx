'use client';

import { useState, useEffect } from 'react';
import { Clock, DollarSign, X, CheckCircle2, Lock, Unlock, Loader2 } from 'lucide-react';
import { formatVND } from '@/lib/utils';

interface ShiftData {
  id: number;
  shiftName: string;
  initialCash: number;
  status: string;
  startTime: string;
}

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftUpdated?: () => void;
}

export default function ShiftModal({ isOpen, onClose, onShiftUpdated }: ShiftModalProps) {
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null);
  const [shiftName, setShiftName] = useState<string>('Ca sáng');
  const [initialCash, setInitialCash] = useState<string>('1000000');
  const [closingCash, setClosingCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchShiftStatus = async () => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      if (data.success && data.activeShift) {
        setActiveShift(data.activeShift);
      } else {
        setActiveShift(null);
      }
    } catch {
      setActiveShift(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      fetchShiftStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenShift = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftName: shiftName || 'Ca sáng',
          initialCash: Number(initialCash || 0),
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Mở ca làm việc thành công!' });
        await fetchShiftStatus();
        if (onShiftUpdated) onShiftUpdated();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: data.error || 'Không thể mở ca' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lỗi hệ thống' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (closingCash === '' || isNaN(Number(closingCash))) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tiền mặt thực tế khi chốt ca' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/shifts/${activeShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closingCash: Number(closingCash),
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Chốt ca làm việc thành công!' });
        await fetchShiftStatus();
        if (onShiftUpdated) onShiftUpdated();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: data.error || 'Không thể chốt ca' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lỗi hệ thống' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative bg-slate-900 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            {activeShift ? 'Quản Lý / Chốt Ca Làm Việc' : 'Mở Ca Làm Việc Mới'}
          </h3>
          <p className="text-xs text-slate-400">
            {activeShift ? `Đang trong ca: ${activeShift.shiftName}` : 'Khai báo thông tin ca và tiền mở két'}
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        {!activeShift ? (
          // Form Mở ca
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tên ca làm việc</label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="VD: Ca sáng, Ca chiều"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tiền mặt đầu ca / két (VND)</label>
              <input
                type="number"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                placeholder="VD: 1000000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Ghi chú (Tùy chọn)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú mở ca..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleOpenShift}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              <span>XÁC NHẬN MỞ CA</span>
            </button>
          </div>
        ) : (
          // Form Chốt ca
          <div className="space-y-4">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Tên ca:</span>
                <span className="font-bold text-white">{activeShift.shiftName}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Tiền ban đầu:</span>
                <span className="font-mono font-bold text-amber-400">{formatVND(activeShift.initialCash)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Thời gian mở:</span>
                <span className="font-mono text-slate-300">
                  {new Date(activeShift.startTime).toLocaleTimeString('vi-VN')}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tiền mặt kiểm đếm khi chốt ca (VND)</label>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="Nhập tổng tiền mặt thực tế trong két"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Ghi chú chốt ca</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú thêm..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleCloseShift}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>XÁC NHẬN CHỐT CA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
