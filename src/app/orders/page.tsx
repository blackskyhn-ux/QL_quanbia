'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { ClipboardList, Search, Eye, Calendar, CheckCircle2, Clock, Banknote, QrCode } from 'lucide-react';
import { formatVND, formatDate } from '@/lib/utils';

interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  customerCount: number;
  createdAt: string;
  paidAt: string | null;
  table?: { name: string };
  items?: any[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'serving' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchSearch =
      search.trim() === '' ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.table && o.table.name.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-amber-400" /> QUẢN LÝ ĐƠN HÀNG & LỊCH SỬ BÁN
            </h1>
            <p className="text-xs text-slate-400 mt-1">Danh sách tất cả các hóa đơn tính tiền, phục vụ và thanh toán</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo mã HD hoặc tên bàn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('serving')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'serving' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đang phục vụ
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'completed' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đã thanh toán
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Mã Hóa Đơn</th>
                  <th className="p-4">Bàn</th>
                  <th className="p-4">Tổng Tiền</th>
                  <th className="p-4">Giảm Giá</th>
                  <th className="p-4">Thành Tiền</th>
                  <th className="p-4">PT Thanh Toán</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4">Thời Gian</th>
                  <th className="p-4 text-center">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Không tìm thấy đơn hàng nào.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-amber-400">{order.orderNumber}</td>
                      <td className="p-4 font-bold text-white">{order.table?.name || `Bàn #${order.tableId}`}</td>
                      <td className="p-4 font-mono text-slate-300">{formatVND(order.totalAmount)}</td>
                      <td className="p-4 font-mono text-rose-400">-{formatVND(order.discountAmount || 0)}</td>
                      <td className="p-4 font-mono font-black text-amber-400 text-sm">{formatVND(order.finalAmount)}</td>
                      <td className="p-4">
                        {order.paymentMethod === 'transfer' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-500/20">
                            <QrCode className="w-3 h-3" /> VietQR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-500/20">
                            <Banknote className="w-3 h-3" /> Tiền mặt
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {order.status === 'completed' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Đã thanh toán
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            Đang phục vụ
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 text-[11px] font-mono">{formatDate(order.createdAt)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Chi tiết đơn #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-amber-400 font-semibold">{selectedOrder.table?.name}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-1">DANH SÁCH MÓN GỌI</div>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                selectedOrder.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-800/40">
                    <span className="text-slate-200">
                      {item.productName} <span className="text-amber-400 font-bold">x{item.quantity}</span>
                    </span>
                    <span className="font-mono text-slate-300">{formatVND(item.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-2">Chưa nạp chi tiết món</div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Tạm tính:</span>
                <span className="font-mono">{formatVND(selectedOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Giảm giá:</span>
                <span className="font-mono">-{formatVND(selectedOrder.discountAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-white font-extrabold text-sm pt-1">
                <span>Thực thu:</span>
                <span className="text-amber-400 font-mono text-base">{formatVND(selectedOrder.finalAmount)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
