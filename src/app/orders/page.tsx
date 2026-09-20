'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Search, Eye, Banknote, QrCode, XCircle, RotateCcw, ShieldAlert, AlertTriangle } from 'lucide-react';
import { formatVND, formatDate } from '@/lib/utils';

interface OrderItem {
  id?: number;
  productName: string;
  quantity: number;
  amount: number;
  unitCost?: number;
}

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
  cancelledAt?: string | null;
  cancelledBy?: number | null;
  cancelReason?: string | null;
  refundedAt?: string | null;
  refundedBy?: number | null;
  refundReason?: string | null;
  refundAmount?: number | null;
  version?: number;
  table?: { name: string };
  items?: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'serving' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Modal states for Cancel / Refund
  const [actionModalType, setActionModalType] = useState<'cancel' | 'refund' | null>(null);
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const url = statusFilter !== 'all' ? `/api/orders?status=${statusFilter}&limit=100` : '/api/orders?limit=100';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleCancelOrder = async () => {
    if (!selectedOrder || !reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do hủy đơn hàng');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Hủy đơn hàng thất bại');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Hủy đơn hàng thành công!');
      setActionModalType(null);
      setReason('');
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder || !reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const amountVal = refundAmount ? parseFloat(refundAmount) : selectedOrder.finalAmount;
      const res = await fetch(`/api/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), refundAmount: amountVal }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Hoàn tiền thất bại');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Hoàn tiền thành công!');
      setActionModalType(null);
      setReason('');
      setRefundAmount('');
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'cancelled'
        ? o.status === 'cancelled' || o.paymentStatus === 'refunded'
        : o.status === statusFilter;

    const matchSearch =
      search.trim() === '' ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.table && o.table.name.toLowerCase().includes(search.toLowerCase()));

    return matchStatus && matchSearch;
  });

  return (
    <>
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-amber-400" /> QUẢN LÝ ĐƠN HÀNG ENTERPRISE
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Quản lý lịch sử bán, hủy đơn, hoàn tiền và truy vết kiểm toán toàn diện
            </p>
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

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('serving')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'serving' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đang phục vụ
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'completed' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đã thanh toán
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'cancelled' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đã hủy / Hoàn tiền
              </button>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

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
                  <th className="p-4 text-center">Thao Tác</th>
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
                        {order.status === 'cancelled' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Đã hủy
                          </span>
                        ) : order.paymentStatus === 'refunded' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            Đã hoàn tiền
                          </span>
                        ) : order.status === 'completed' ? (
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
                          title="Xem chi tiết đơn"
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

      {/* Detail & Action Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Chi tiết đơn #{selectedOrder.orderNumber}
                  {selectedOrder.status === 'cancelled' && (
                    <span className="text-xs text-rose-400 font-semibold border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      ĐÃ HỦY
                    </span>
                  )}
                  {selectedOrder.paymentStatus === 'refunded' && (
                    <span className="text-xs text-orange-400 font-semibold border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      HOÀN TIỀN
                    </span>
                  )}
                </h3>
                <p className="text-xs text-amber-400 font-semibold">{selectedOrder.table?.name}</p>
              </div>
              <button onClick={() => { setSelectedOrder(null); setActionModalType(null); }} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            {/* Audit Info if Cancelled/Refunded */}
            {(selectedOrder.cancelReason || selectedOrder.refundReason) && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold text-rose-400">
                  <ShieldAlert className="w-4 h-4" /> Thông tin hủy / hoàn tiền:
                </div>
                {selectedOrder.cancelReason && (
                  <p className="text-slate-300">Lý do hủy: <span className="font-semibold text-white">{selectedOrder.cancelReason}</span></p>
                )}
                {selectedOrder.refundReason && (
                  <p className="text-slate-300">Lý do hoàn tiền: <span className="font-semibold text-white">{selectedOrder.refundReason}</span> (Số tiền: {formatVND(selectedOrder.refundAmount || selectedOrder.finalAmount)})</p>
                )}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-1 flex justify-between">
                <span>DANH SÁCH MÓN GỌI</span>
                <span>THÀNH TIỀN</span>
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                selectedOrder.items.map((item, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs py-1.5 border-b border-slate-800/40">
                    <div>
                      <div className="text-slate-200 font-medium">
                        {item.productName} <span className="text-amber-400 font-bold">x{item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-mono text-slate-300 font-semibold">{formatVND(item.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-2">Chưa nạp chi tiết món</div>
              )}
            </div>

            {/* Price breakdown */}
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

            {/* Cancellation / Refund prompt form */}
            {actionModalType ? (
              <div className="p-4 bg-slate-900 border border-slate-700/80 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {actionModalType === 'cancel' ? 'Xác nhận hủy đơn hàng' : 'Xác nhận hoàn tiền đơn hàng'}
                </h4>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Lý do (Bắt buộc):</label>
                  <input
                    type="text"
                    placeholder={actionModalType === 'cancel' ? 'Nhập lý do hủy...' : 'Nhập lý do hoàn tiền...'}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {actionModalType === 'refund' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Số tiền hoàn (VND):</label>
                    <input
                      type="number"
                      placeholder={selectedOrder.finalAmount.toString()}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionModalType(null)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
                  >
                    Hủy thao tác
                  </button>
                  <button
                    onClick={actionModalType === 'cancel' ? handleCancelOrder : handleRefundOrder}
                    disabled={isSubmitting}
                    className={`flex-1 py-2 text-white rounded-lg text-xs font-bold transition-all ${
                      actionModalType === 'cancel' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-orange-600 hover:bg-orange-500'
                    }`}
                  >
                    {isSubmitting ? 'Đang xử lý...' : actionModalType === 'cancel' ? 'Xác nhận hủy đơn' : 'Xác nhận hoàn tiền'}
                  </button>
                </div>
              </div>
            ) : (
              /* Action buttons */
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                {selectedOrder.status !== 'cancelled' && selectedOrder.paymentStatus !== 'refunded' && (
                  <button
                    onClick={() => setActionModalType('cancel')}
                    className="flex-1 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Hủy Đơn Hàng
                  </button>
                )}

                {selectedOrder.status === 'completed' && selectedOrder.paymentStatus === 'paid' && (
                  <button
                    onClick={() => setActionModalType('refund')}
                    className="flex-1 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> Hoàn Tiền
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
