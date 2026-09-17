'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { BarChart3, TrendingUp, DollarSign, Beer, QrCode, Banknote, ShoppingBag } from 'lucide-react';
import { formatVND } from '@/lib/utils';

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setOrders(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
  const totalCash = completedOrders.filter((o) => o.paymentMethod === 'cash').reduce((sum, o) => sum + (o.finalAmount || 0), 0);
  const totalTransfer = completedOrders.filter((o) => o.paymentMethod === 'transfer').reduce((sum, o) => sum + (o.finalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-400" /> BÁO CÁO & THỐNG KÊ DOANH THU
            </h1>
            <p className="text-xs text-slate-400 mt-1">Tổng quan doanh thu kinh doanh Quán Bia realtime</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
            <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
              <span>TỔNG DOANH THU</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">{formatVND(totalRevenue)}</div>
            <div className="text-[11px] text-slate-500">Từ {completedOrders.length} đơn hàng đã hoàn tất</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
            <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
              <span>THANH TOÁN VIETQR</span>
              <QrCode className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">{formatVND(totalTransfer)}</div>
            <div className="text-[11px] text-slate-500">Chuyển khoản Napas247</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
            <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
              <span>TIỀN MẶT KÉT</span>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{formatVND(totalCash)}</div>
            <div className="text-[11px] text-slate-500">Thu trực tiếp tại quầy</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
            <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
              <span>TỔNG ĐƠN PHỤC VỤ</span>
              <ShoppingBag className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400 font-mono">{orders.length} đơn</div>
            <div className="text-[11px] text-slate-500">{orders.filter((o) => o.status === 'serving').length} đơn đang mở</div>
          </div>
        </div>
      </main>
    </div>
  );
}
