'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Settings,
  PlusCircle,
  SlidersHorizontal,
  RefreshCw,
  XCircle,
  TrendingUp,
  DollarSign,
  Boxes,
  Loader2,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { formatVND, formatDate } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  code: string;
  price: number;
  costPrice: number;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  categoryId: number;
  categoryName: string;
  isAvailable: boolean;
}

interface InventoryLog {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  unit: string;
  type: 'import' | 'export' | 'order_deduct' | 'adjustment' | string;
  quantity: number;
  previousStock: number;
  newStock: number;
  note: string;
  createdBy: number;
  createdAt: string;
  userFullName: string;
}

interface Category {
  id: number;
  name: string;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalInventoryValue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'safe'>('all');
  const [selectedProductLogFilter, setSelectedProductLogFilter] = useState<string>('all');

  // Modals
  const [importModalProduct, setImportModalProduct] = useState<Product | null>(null);
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [settingsModalProduct, setSettingsModalProduct] = useState<Product | null>(null);

  // Form states
  const [importQty, setImportQty] = useState<string>('');
  const [importCostPrice, setImportCostPrice] = useState<string>('');
  const [importNote, setImportNote] = useState<string>('');

  const [adjustNewStock, setAdjustNewStock] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  const [settingsMinStock, setSettingsMinStock] = useState<string>('');
  const [settingsCostPrice, setSettingsCostPrice] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products || []);
        setLogs(data.data.logs || []);
        setSummary(
          data.data.summary || {
            totalItems: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
            totalInventoryValue: 0,
          }
        );
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchInventoryData();
    fetchCategories();
  }, []);

  // Lock body & html scroll when any modal is open
  useEffect(() => {
    if (importModalProduct || adjustModalProduct || settingsModalProduct) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [importModalProduct, adjustModalProduct, settingsModalProduct]);

  const openImportModal = (product: Product) => {
    setImportModalProduct(product);
    setImportQty('10');
    setImportCostPrice(product.costPrice ? product.costPrice.toString() : '');
    setImportNote('');
    setErrorMessage(null);
  };

  const openAdjustModal = (product: Product) => {
    setAdjustModalProduct(product);
    setAdjustNewStock(product.stockQuantity.toString());
    setAdjustReason('');
    setErrorMessage(null);
  };

  const openSettingsModal = (product: Product) => {
    setSettingsModalProduct(product);
    setSettingsMinStock((product.minStockLevel || 10).toString());
    setSettingsCostPrice((product.costPrice || 0).toString());
    setErrorMessage(null);
  };

  // Submit Handlers
  const handleImportSubmit = async () => {
    if (!importModalProduct || !importQty || Number(importQty) <= 0) {
      setErrorMessage('Vui lòng nhập số lượng hợp lệ (> 0)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: importModalProduct.id,
          quantity: Number(importQty),
          costPrice: importCostPrice !== '' ? Number(importCostPrice) : undefined,
          note: importNote,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Lỗi nhập kho');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message || 'Nhập kho thành công!');
      setImportModalProduct(null);
      await fetchInventoryData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustModalProduct || adjustNewStock === '' || Number(adjustNewStock) < 0) {
      setErrorMessage('Vui lòng nhập số lượng tồn thực tế (>= 0)');
      return;
    }

    if (!adjustReason.trim()) {
      setErrorMessage('Vui lòng nhập lý do điều chỉnh / kiểm kê');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustModalProduct.id,
          newStockQuantity: Number(adjustNewStock),
          reason: adjustReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Lỗi điều chỉnh tồn kho');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message || 'Điều chỉnh kho thành công!');
      setAdjustModalProduct(null);
      await fetchInventoryData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettingsSubmit = async () => {
    if (!settingsModalProduct) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/inventory/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: settingsModalProduct.id,
          minStockLevel: settingsMinStock !== '' ? Number(settingsMinStock) : undefined,
          costPrice: settingsCostPrice !== '' ? Number(settingsCostPrice) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Lỗi lưu cấu hình');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message || 'Lưu cấu hình thành công!');
      setSettingsModalProduct(null);
      await fetchInventoryData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || p.categoryId === Number(selectedCategory);

    const minLevel = p.minStockLevel || 10;
    const isLow = p.stockQuantity <= minLevel && p.stockQuantity > 0;
    const isOut = p.stockQuantity <= 0;

    let matchesStatus = true;
    if (stockStatusFilter === 'low') matchesStatus = isLow;
    else if (stockStatusFilter === 'out') matchesStatus = isOut;
    else if (stockStatusFilter === 'safe') matchesStatus = !isLow && !isOut;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Filtering logs
  const filteredLogs = logs.filter((log) => {
    const matchesProduct =
      selectedProductLogFilter === 'all' || log.productId === Number(selectedProductLogFilter);
    const matchesSearch =
      search.trim() === '' ||
      log.productName.toLowerCase().includes(search.toLowerCase()) ||
      (log.note && log.note.toLowerCase().includes(search.toLowerCase())) ||
      (log.userFullName && log.userFullName.toLowerCase().includes(search.toLowerCase()));

    return matchesProduct && matchesSearch;
  });

  return (
    <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" /> QUẢN LÝ KHO & BIẾN ĐỘNG TỒN KHO ENTERPRISE
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi nhập xuất tồn, kiểm kê hao hụt, giá vốn và lịch sử biến động thực tế
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchInventoryData()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Tải lại</span>
          </button>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" /> Danh Sách Tồn Kho
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'logs'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" /> Lịch Sử Biến Động
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tổng Mặt Hàng</p>
            <p className="text-2xl font-black text-white mt-1">{summary.totalItems}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Đang quản lý trong kho</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Giá Trị Vốn Tồn Kho</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-1">
              {formatVND(summary.totalInventoryValue)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Tính theo giá vốn nhập</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sắp Hết Hàng</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{summary.lowStockCount}</p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">Chạm ngưỡng cảnh báo</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Đã Hết Kho</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{summary.outOfStockCount}</p>
            <p className="text-[10px] text-rose-500/70 mt-0.5">Cần nhập kho gấp</p>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Global Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            {errorMessage}
          </span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, mã hàng, hoặc lý do..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {activeTab === 'overview' ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Stock status filter */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  stockStatusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  stockStatusFilter === 'low' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sắp hết
              </button>
              <button
                onClick={() => setStockStatusFilter('out')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  stockStatusFilter === 'out' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hết hàng
              </button>
              <button
                onClick={() => setStockStatusFilter('safe')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  stockStatusFilter === 'safe' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                An toàn
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedProductLogFilter}
              onChange={(e) => setSelectedProductLogFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 max-w-xs"
            >
              <option value="all">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.code ? `[${p.code}] ` : ''}{p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* MAIN TAB CONTENT */}
      {activeTab === 'overview' ? (
        /* Inventory Table Tab */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Mã Hàng</th>
                  <th className="p-4">Tên Mặt Hàng</th>
                  <th className="p-4">Danh Mục</th>
                  <th className="p-4">Đơn Vị</th>
                  <th className="p-4">Giá Vốn (VND)</th>
                  <th className="p-4">Giá Bán (VND)</th>
                  <th className="p-4">Tồn Kho Hiện Tại</th>
                  <th className="p-4">Cảnh Báo (Tối Thiểu)</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-center">Thao Tác Kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      Không tìm thấy sản phẩm nào trong kho.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const minLevel = product.minStockLevel || 10;
                    const isLow = product.stockQuantity <= minLevel && product.stockQuantity > 0;
                    const isOut = product.stockQuantity <= 0;

                    return (
                      <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-amber-400">{product.code || `#${product.id}`}</td>
                        <td className="p-4 font-bold text-white text-sm">{product.name}</td>
                        <td className="p-4 text-slate-400">{product.categoryName}</td>
                        <td className="p-4 font-mono text-slate-300">{product.unit}</td>
                        <td className="p-4 font-mono text-slate-300">{formatVND(product.costPrice || 0)}</td>
                        <td className="p-4 font-mono text-amber-400 font-semibold">{formatVND(product.price)}</td>
                        <td className="p-4 font-mono font-extrabold text-white text-base">
                          {product.stockQuantity}
                        </td>
                        <td className="p-4 font-mono text-slate-400">{minLevel}</td>
                        <td className="p-4">
                          {isOut ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max animate-pulse">
                              <XCircle className="w-3 h-3" /> Đã Hết Kho
                            </span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max">
                              <AlertTriangle className="w-3 h-3" /> Cần Nhập Thêm
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3" /> An Toàn
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openImportModal(product)}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              title="Nhập thêm kho"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> Nhập Kho
                            </button>
                            <button
                              onClick={() => openAdjustModal(product)}
                              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              title="Kiểm kê / Điều chỉnh tồn kho"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" /> Kiểm Kê
                            </button>
                            <button
                              onClick={() => openSettingsModal(product)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                              title="Cấu hình giá vốn & ngưỡng"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Inventory Logs History Tab */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Thời Gian</th>
                  <th className="p-4">Sản Phẩm</th>
                  <th className="p-4">Loại Thao Tác</th>
                  <th className="p-4">Số Lượng Biến Động</th>
                  <th className="p-4">Thay Đổi Tồn Kho</th>
                  <th className="p-4">Ghi Chú / Lý Do</th>
                  <th className="p-4">Người Thực Hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Chưa có lịch sử biến động kho nào.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isPositive = log.quantity > 0;

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono text-slate-400">{formatDate(log.createdAt)}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{log.productName}</div>
                          {log.productCode && <div className="text-[10px] text-amber-400 font-mono">{log.productCode}</div>}
                        </td>
                        <td className="p-4">
                          {log.type === 'import' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <ArrowDownRight className="w-3.5 h-3.5" /> Nhập Kho
                            </span>
                          ) : log.type === 'order_deduct' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" /> Khách Gọi Món
                            </span>
                          ) : log.type === 'export' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Xuất Kho / Hủy
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                              <SlidersHorizontal className="w-3.5 h-3.5" /> Điều Chỉnh
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono font-bold text-sm">
                          <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${log.quantity}` : log.quantity} {log.unit}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-300 text-xs">
                          {log.previousStock} <span className="text-slate-500">➔</span>{' '}
                          <strong className="text-white">{log.newStock}</strong> {log.unit}
                        </td>
                        <td className="p-4 text-slate-300">{log.note || '-'}</td>
                        <td className="p-4 font-semibold text-slate-300">{log.userFullName || 'Hệ thống'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL NHẬP KHO ================= */}
      {mounted && importModalProduct && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" /> Nhập Kho Thêm
                </h3>
                <p className="text-xs text-amber-400 font-bold mt-0.5">{importModalProduct.name}</p>
              </div>
              <button onClick={() => setImportModalProduct(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số lượng nhập thêm ({importModalProduct.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={importQty}
                  onChange={(e) => setImportQty(e.target.value)}
                  placeholder="Ví dụ: 20"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Giá vốn nhập mỗi đơn vị (VND):
                </label>
                <input
                  type="number"
                  value={importCostPrice}
                  onChange={(e) => setImportCostPrice(e.target.value)}
                  placeholder={importModalProduct.costPrice ? importModalProduct.costPrice.toString() : '0'}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi chú / Nhà cung cấp:</label>
                <input
                  type="text"
                  value={importNote}
                  onChange={(e) => setImportNote(e.target.value)}
                  placeholder="Ví dụ: Đại lý Sabeco, Hóa đơn #123..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => setImportModalProduct(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Nhập Kho'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL ĐIỀU CHỈNH KHO / KIỂM KÊ ================= */}
      {mounted && adjustModalProduct && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-400" /> Kiểm Kê / Điều Chỉnh Tồn Kho
                </h3>
                <p className="text-xs text-amber-400 font-bold mt-0.5">{adjustModalProduct.name}</p>
              </div>
              <button onClick={() => setAdjustModalProduct(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <span className="text-slate-400">Tồn kho hiện tại trong hệ thống:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {adjustModalProduct.stockQuantity} {adjustModalProduct.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tồn kho THỰC TẾ đếm được ({adjustModalProduct.unit}):
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustNewStock}
                  onChange={(e) => setAdjustNewStock(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-sm text-white font-mono outline-none"
                />
                {adjustNewStock !== '' && (
                  <p className="text-[11px] mt-1.5 font-bold flex items-center gap-1">
                    Chênh lệch:{' '}
                    <span
                      className={
                        Number(adjustNewStock) - adjustModalProduct.stockQuantity >= 0
                          ? 'text-emerald-400 font-mono'
                          : 'text-rose-400 font-mono'
                      }
                    >
                      {Number(adjustNewStock) - adjustModalProduct.stockQuantity >= 0 ? '+' : ''}
                      {Number(adjustNewStock) - adjustModalProduct.stockQuantity} {adjustModalProduct.unit}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lý do điều chỉnh (Bắt buộc):
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ví dụ: Bia vỡ chai, Hao hụt kiểm kê cuối tháng, Hết hạn..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => setAdjustModalProduct(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
                {isSubmitting ? 'Đang lưu...' : 'Xác Nhận Điều Chỉnh'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL CẤU HÌNH NGƯỠNG & GIÁ VỐN ================= */}
      {mounted && settingsModalProduct && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-400" /> Cấu Hình Kho & Giá Vốn
                </h3>
                <p className="text-xs text-amber-400 font-bold mt-0.5">{settingsModalProduct.name}</p>
              </div>
              <button onClick={() => setSettingsModalProduct(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ngưỡng cảnh báo sắp hết (Tối thiểu):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settingsMinStock}
                  onChange={(e) => setSettingsMinStock(e.target.value)}
                  placeholder="Ví dụ: 10"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-sm text-white font-mono outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Khi tồn kho dưới số này, hệ thống sẽ cảnh báo "Cần nhập thêm"</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Giá vốn nhập mặc định (VND):
                </label>
                <input
                  type="number"
                  min="0"
                  value={settingsCostPrice}
                  onChange={(e) => setSettingsCostPrice(e.target.value)}
                  placeholder="Ví dụ: 15000"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-sm text-white font-mono outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Dùng để tính tổng giá trị tài sản kho và lợi nhuận gộp</p>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => setSettingsModalProduct(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={handleSettingsSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
