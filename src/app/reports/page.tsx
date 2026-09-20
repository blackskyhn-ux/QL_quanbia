'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  QrCode,
  Banknote,
  ShoppingBag,
  Download,
  Calendar,
  Layers,
  PieChart,
  ArrowUpRight,
  TrendingDown,
  Percent,
  RefreshCw,
  PackageCheck,
  AlertOctagon,
} from 'lucide-react';
import { formatVND } from '@/lib/utils';

interface ReportData {
  summary: {
    totalRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    totalDiscount: number;
    completedCount: number;
    cancelledCount: number;
    cancelledAmount: number;
    servingCount: number;
    averageOrderValue: number;
  };
  paymentMethods: {
    cash: { count: number; total: number };
    transfer: { count: number; total: number };
    card: { count: number; total: number };
  };
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
    cogs: number;
    profit: number;
  }[];
  trend: {
    label: string;
    revenue: number;
    profit: number;
    orderCount: number;
  }[];
  shifts: any[];
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/reports?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Không thể lấy dữ liệu báo cáo');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [period]);

  const handleCustomDateSubmit = () => {
    if (startDate && endDate) {
      fetchReports();
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Tên Sản Phẩm', 'Số Lượng Bán', 'Doanh Thu (VND)', 'Giá Vốn (VND)', 'Lợi Nhuận (VND)'];
    const rows = data.topProducts.map((p) => [
      `"${p.name}"`,
      p.quantity,
      p.revenue,
      p.cogs,
      p.profit,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bao_cao_doanh_thu_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-400" /> BÁO CÁO & THỐNG KÊ TÀI CHÍNH ENTERPRISE
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Phân tích doanh thu, giá vốn (COGS), lợi nhuận gộp và hiệu suất kinh doanh thời gian thực
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Period Selector Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
              {[
                { key: 'today', label: 'Hôm nay' },
                { key: 'yesterday', label: 'Hôm qua' },
                { key: '7days', label: '7 ngày' },
                { key: '30days', label: '30 ngày' },
                { key: 'month', label: 'Tháng này' },
                { key: 'last_month', label: 'Tháng trước' },
                { key: 'year', label: 'Năm nay' },
                { key: 'custom', label: 'Tùy chọn' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPeriod(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    period === tab.key ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Custom Range Picker */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <Calendar className="w-4 h-4 text-amber-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 focus:outline-none"
                />
                <span className="text-xs text-slate-500">đến</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 focus:outline-none"
                />
                <button
                  onClick={handleCustomDateSubmit}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded"
                >
                  Lọc
                </button>
              </div>
            )}

            <button
              onClick={handleExportCSV}
              disabled={!data}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Xuất Excel / CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 h-28">
                  <div className="h-3 w-28 bg-slate-800/80 rounded"></div>
                  <div className="h-7 w-36 bg-slate-800/80 rounded"></div>
                  <div className="h-3 w-24 bg-slate-800/80 rounded"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-80">
                <div className="h-5 w-48 bg-slate-800/80 rounded"></div>
                <div className="h-60 w-full bg-slate-800/40 rounded-xl"></div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-80">
                <div className="h-5 w-36 bg-slate-800/80 rounded"></div>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="h-10 w-full bg-slate-800/40 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-2xl text-center space-y-3">
            <AlertOctagon className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={fetchReports}
              className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Thử lại
            </button>
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-slate-500">Chưa có dữ liệu báo cáo.</div>
        ) : (
          <>
            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Revenue */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>TỔNG DOANH THU THỰC THU</span>
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {formatVND(data.summary.totalRevenue)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Hoàn tất: <strong className="text-white">{data.summary.completedCount} đơn</strong></span>
                  <span className="text-slate-500">Giảm giá: -{formatVND(data.summary.totalDiscount)}</span>
                </div>
              </div>

              {/* COGS & Profit */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>LỢI NHUẬN GỘP (GROSS PROFIT)</span>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {formatVND(data.summary.grossProfit)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Giá vốn (COGS): <strong className="text-rose-400">{formatVND(data.summary.cogs)}</strong></span>
                  <span className="text-emerald-400 font-bold flex items-center">
                    <Percent className="w-3 h-3" /> Margin: {data.summary.grossMargin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Average Order Value */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>GIÁ TRỊ ĐƠN TRUNG BÌNH (AOV)</span>
                  <ShoppingBag className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {formatVND(data.summary.averageOrderValue)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Phục vụ: <strong className="text-white">{data.summary.servingCount} đơn đang mở</strong>
                </div>
              </div>

              {/* Cancelled / Refunded */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                  <span>ĐƠN HỦY / HOÀN TIỀN</span>
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  {formatVND(data.summary.cancelledAmount)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Số lượng đơn hủy: <strong className="text-rose-300">{data.summary.cancelledCount} đơn</strong>
                </div>
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-400" /> Tiền mặt (Cash)
                  </span>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {formatVND(data.paymentMethods.cash.total)}
                  </div>
                  <p className="text-[11px] text-slate-500">{data.paymentMethods.cash.count} giao dịch</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-400" /> VietQR / Chuyển khoản
                  </span>
                  <div className="text-xl font-bold font-mono text-amber-400">
                    {formatVND(data.paymentMethods.transfer.total)}
                  </div>
                  <p className="text-[11px] text-slate-500">{data.paymentMethods.transfer.count} giao dịch</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" /> Thẻ ngân hàng (Card)
                  </span>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {formatVND(data.paymentMethods.card.total)}
                  </div>
                  <p className="text-[11px] text-slate-500">{data.paymentMethods.card.count} giao dịch</p>
                </div>
              </div>
            </div>

            {/* Product Performance Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-400" /> BẢNG XẾP HẠNG SẢN PHẨM BÁN CHẠY
                </h3>
                <span className="text-xs text-slate-500">Tự động tính toán theo doanh thu & lợi nhuận</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Tên Sản Phẩm</th>
                      <th className="p-3 text-center">Số Lượng Bán</th>
                      <th className="p-3 text-right">Doanh Thu</th>
                      <th className="p-3 text-right">Giá Vốn (COGS)</th>
                      <th className="p-3 text-right">Lợi Nhuận Gộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.topProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500">
                          Chưa có dữ liệu bán hàng trong khoảng thời gian này.
                        </td>
                      </tr>
                    ) : (
                      data.topProducts.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-amber-400">{idx + 1}</td>
                          <td className="p-3 font-semibold text-white">{prod.name}</td>
                          <td className="p-3 text-center font-mono font-bold text-amber-400">{prod.quantity}</td>
                          <td className="p-3 text-right font-mono text-slate-200 font-semibold">{formatVND(prod.revenue)}</td>
                          <td className="p-3 text-right font-mono text-rose-400">{formatVND(prod.cogs)}</td>
                          <td className="p-3 text-right font-mono font-extrabold text-emerald-400">{formatVND(prod.profit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
  );
}
