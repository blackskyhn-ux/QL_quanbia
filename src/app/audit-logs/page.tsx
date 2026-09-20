'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  performedBy: number | null;
  reason: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  performerName: string | null;
  performerUsername: string | null;
}

interface Stats {
  totalLogs: number;
  sensitiveCount: number;
  financialRefundTotal: number;
  tableMoveCount: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalLogs: 0,
    sensitiveCount: 0,
    financialRefundTotal: 0,
    tableMoveCount: 0,
  });

  // Filters & Pagination State
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('all'); // all, today, yesterday, 7days, 30days
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected Log for Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let startDateStr = '';
      let endDateStr = '';
      const now = new Date();

      if (dateRange === 'today') {
        startDateStr = now.toISOString().split('T')[0];
        endDateStr = startDateStr;
      } else if (dateRange === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        startDateStr = y.toISOString().split('T')[0];
        endDateStr = startDateStr;
      } else if (dateRange === '7days') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 7);
        startDateStr = d7.toISOString().split('T')[0];
        endDateStr = now.toISOString().split('T')[0];
      } else if (dateRange === '30days') {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 30);
        startDateStr = d30.toISOString().split('T')[0];
        endDateStr = now.toISOString().split('T')[0];
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        category,
        search,
      });

      if (startDateStr) queryParams.append('startDate', startDateStr);
      if (endDateStr) queryParams.append('endDate', endDateStr);

      const res = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      const json = await res.json();

      if (json.success) {
        setLogs(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotalCount(json.pagination.total || 0);
        }
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        if (json.error?.includes('quyền')) {
          window.location.href = '/pos';
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải nhật ký hoạt động:', err);
    } finally {
      setLoading(false);
    }
  }, [category, search, dateRange, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format Helper: Badge Styles for Action Types
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PAYMENT_COMPLETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">💳 Thanh toán thành công</span>;
      case 'ORDER_CANCELLED':
      case 'ORDER_CANCELLED_WITH_REFUND':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">❌ Hủy đơn hàng</span>;
      case 'ORDER_REFUNDED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">💸 Hoàn tiền đơn</span>;
      case 'ITEM_CANCELLED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">⚠️ Hủy / Bớt món</span>;
      case 'DISCOUNT_APPLIED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">🏷️ Giảm giá / Chiết khấu</span>;
      case 'TABLE_MOVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">🔀 Chuyển bàn</span>;
      case 'TABLE_MERGED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">🔗 Gộp bàn</span>;
      case 'PRODUCT_CREATED':
      case 'PRODUCT_UPDATED':
      case 'PRODUCT_DELETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">📦 Quản lý Thực đơn</span>;
      case 'USER_LOGIN':
      case 'USER_LOGOUT':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/20">🔑 Đăng nhập/Đăng xuất</span>;
      case 'USER_CREATED':
      case 'USER_UPDATED':
      case 'USER_DELETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">👤 Nhân sự & Quyền</span>;
      case 'SETTING_UPDATED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">⚙️ Cấu hình POS</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-300">{action}</span>;
    }
  };

  // Export to CSV
  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Thời Gian', 'Thao Tác', 'Người Thực Hiện', 'Lý Do / Mô Tả', 'Giá Trị Cũ', 'Giá Trị Mới'];
    const rows = logs.map((l) => [
      l.id,
      new Date(l.createdAt).toLocaleString('vi-VN'),
      l.action,
      l.performerName || l.performerUsername || 'Hệ thống',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format Helper for JSON rendering
  const parseJsonValue = (val: string | null) => {
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Title Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                Nhật Ký Thao Tác (Audit Logs)
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Giám sát & kiểm soát toàn bộ biến động tài chính, hủy món, sơ đồ bàn, tồn kho và phân quyền hệ thống.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              🔄 Tải lại
            </button>
            <button
              onClick={exportCSV}
              className="px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center gap-1.5"
            >
              📥 Xuất CSV
            </button>
          </div>
        </div>

        {/* 4 Executive Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng số lượt nhật ký</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalLogs.toLocaleString('vi-VN')}</div>
            <div className="text-[11px] text-slate-500 mt-1">Tất cả thao tác trên hệ thống</div>
          </div>

          <div className="bg-slate-900/90 border border-rose-500/20 p-4 rounded-2xl shadow-lg">
            <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center justify-between">
              <span>Thao tác nhạy cảm</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{stats.sensitiveCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Hủy đơn, hoàn tiền, bớt món</div>
          </div>

          <div className="bg-slate-900/90 border border-amber-500/20 p-4 rounded-2xl shadow-lg">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Tổng giá trị hoàn/hủy</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.financialRefundTotal.toLocaleString('vi-VN')} đ</div>
            <div className="text-[11px] text-slate-400 mt-1">Biến động giảm trừ doanh thu</div>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/20 p-4 rounded-2xl shadow-lg">
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Sơ đồ Bàn (Chuyển/Gộp)</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{stats.tableMoveCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Chuyển & gộp đơn hàng</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-4 shadow-xl">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
            {[
              { id: 'all', label: 'Tất cả', icon: '🌐' },
              { id: 'financial', label: '💳 Tài chính & Hủy đơn', icon: '💰' },
              { id: 'orders', label: '🍽️ Đơn & Bàn', icon: '🪑' },
              { id: 'inventory', label: '📦 Kho & Thực đơn', icon: '🍺' },
              { id: 'security', label: '🔒 Nhân sự & Cấu hình', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setCategory(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  category === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Date Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <input
                type="text"
                placeholder="Tìm theo mã đơn, lý do, người thực hiện, tên món hoặc bàn..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 text-slate-200 placeholder-slate-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div className="md:col-span-4 flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'today', label: 'Hôm nay' },
                { id: 'yesterday', label: 'Hôm qua' },
                { id: '7days', label: '7 ngày' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDateRange(d.id);
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition ${
                    dateRange === d.id ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Thời Gian</th>
                  <th className="py-3.5 px-4">Người Thực Hiện</th>
                  <th className="py-3.5 px-4">Thao Tác</th>
                  <th className="py-3.5 px-4">Lý Do / Chi Tiết</th>
                  <th className="py-3.5 px-4 text-right">Biến Động Dữ Liệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-2 text-xs">Đang tải nhật ký hoạt động...</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      📭 Không tìm thấy nhật ký hoạt động nào phù hợp với bộ lọc
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-semibold">
                          {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
                            {(log.performerName || log.performerUsername || 'S')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">
                              {log.performerName || log.performerUsername || 'Hệ thống'}
                            </div>
                            <div className="text-[10px] text-slate-500">ID: #{log.performedBy || 'System'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>

                      <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                        <p className="text-slate-300 font-medium truncate" title={log.reason || ''}>
                          {log.reason || '—'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 rounded-lg transition"
                        >
                          👁️ Xem So Sánh / JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Hiển thị <span className="font-bold text-slate-200">{logs.length}</span> / {totalCount} nhật ký (Trang {page} / {totalPages})
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg border border-slate-700 font-semibold"
              >
                ◀ Trang trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg border border-slate-700 font-semibold"
              >
                Trang sau ▶
              </button>
            </div>
          </div>
        </div>

      {/* JSON Diff & Detailed Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Chi tiết biến động dữ liệu #{selectedLog.id}</h3>
                  <p className="text-[11px] text-slate-400">{new Date(selectedLog.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hành động:</span>
                  <span>{getActionBadge(selectedLog.action)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Người thực hiện:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedLog.performerName || selectedLog.performerUsername || 'Hệ thống'} (ID: #{selectedLog.performedBy || 'Sys'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lý do / Mô tả:</span>
                  <span className="text-slate-200 font-medium text-right max-w-xs">{selectedLog.reason || 'Không có mô tả'}</span>
                </div>
              </div>

              {/* Side by side JSON Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Old Value */}
                <div className="bg-slate-950 rounded-xl border border-rose-900/30 p-3 flex flex-col">
                  <div className="text-[11px] font-bold text-rose-400 pb-2 border-b border-rose-900/30 flex items-center gap-1">
                    <span>🔴</span> Dữ liệu Trước Biến Động (Old Value)
                  </div>
                  <pre className="mt-2 text-[11px] text-rose-200/80 font-mono whitespace-pre-wrap overflow-x-auto flex-1 p-2 bg-rose-950/20 rounded-lg">
                    {selectedLog.oldValue
                      ? typeof parseJsonValue(selectedLog.oldValue) === 'object'
                        ? JSON.stringify(parseJsonValue(selectedLog.oldValue), null, 2)
                        : selectedLog.oldValue
                      : 'Không có dữ liệu cũ (Tạo mới)'}
                  </pre>
                </div>

                {/* New Value */}
                <div className="bg-slate-950 rounded-xl border border-emerald-900/30 p-3 flex flex-col">
                  <div className="text-[11px] font-bold text-emerald-400 pb-2 border-b border-emerald-900/30 flex items-center gap-1">
                    <span>🟢</span> Dữ liệu Sau Biến Động (New Value)
                  </div>
                  <pre className="mt-2 text-[11px] text-emerald-200/80 font-mono whitespace-pre-wrap overflow-x-auto flex-1 p-2 bg-emerald-950/20 rounded-lg">
                    {selectedLog.newValue
                      ? typeof parseJsonValue(selectedLog.newValue) === 'object'
                        ? JSON.stringify(parseJsonValue(selectedLog.newValue), null, 2)
                        : selectedLog.newValue
                      : 'Không có dữ liệu mới (Xóa)'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
