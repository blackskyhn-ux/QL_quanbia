'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Beer,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  QrCode,
  Banknote,
  CreditCard,
  Printer,
  Users,
  Utensils,
  ArrowRightLeft,
  X,
  Loader2,
  Receipt,
  Edit3,
} from 'lucide-react';
import Image from 'next/image';
import { formatVND } from '@/lib/utils';

import ToastContainer, { ToastMessage } from '@/components/Toast';

interface Area {
  id: number;
  name: string;
  tables: Table[];
}

interface Table {
  id: number;
  areaId: number;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  currentOrderId: number | null;
  currentOrder?: Order | null;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Product {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  price: number;
  unit: string;
  stockQuantity: number;
  imageUrl: string | null;
}

interface OrderItem {
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  note?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  totalAmount: number;
  discountAmount: number;
  discountPercent: number;
  finalAmount: number;
  status: string;
  customerCount?: number;
  notes?: string;
  version?: number;
  items?: OrderItem[];
  updatedAt?: string;
}

interface ReceiptData {
  tableName: string;
  orderId: number;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string;
  receivedCash: number;
  changeAmount: number;
  items: OrderItem[];
  date: string;
}

export default function PosPage() {
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    /* eslint-disable react-hooks/purity */
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
    /* eslint-enable react-hooks/purity */
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Bank & Shop Settings
  const [bankConfig, setBankConfig] = useState<{
    bankId: string;
    accountNo: string;
    accountName: string;
    shopName: string;
    shopPhone: string;
    shopAddress: string;
  }>({
    bankId: 'MBBank',
    accountNo: '0988888888',
    accountName: 'QUAN BIA CLUB',
    shopName: 'QUÁN BIA CLUB',
    shopPhone: '0988.888.888',
    shopAddress: '123 Đường Nhậu Mát Lạnh, Hà Nội',
  });

  // State
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | 'all'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Selected Table & Order
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(2);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [orderUpdatedAt, setOrderUpdatedAt] = useState<string | null>(null);

  // Item Note Modal
  const [editingItemNote, setEditingItemNote] = useState<{ productId: number; productName: string; note: string } | null>(null);

  // Move / Merge Table state
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState<number | null>(null);
  const [isMovingTable, setIsMovingTable] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'tables' | 'menu'>('tables');
  const [savingOrder, setSavingOrder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('transfer');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [paidReceipt, setPaidReceipt] = useState<ReceiptData | null>(null);

  // Load Settings & Initial Data with Auto Sync
  const loadData = async (keepTableId?: number) => {
    try {
      const [resAreas, resCats, resProds, resSettings] = await Promise.all([
        fetch('/api/areas').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);

      if (resSettings.success && resSettings.settings) {
        const s = resSettings.settings;
        setBankConfig({
          bankId: s.vietqr_bank_id || 'MBBank',
          accountNo: s.vietqr_account_no || '0988888888',
          accountName: s.vietqr_account_name || 'QUAN BIA CLUB',
          shopName: s.shop_name || 'QUÁN BIA CLUB',
          shopPhone: s.shop_phone || '0988.888.888',
          shopAddress: s.shop_address || '123 Đường Nhậu Mát Lạnh, Hà Nội',
        });
      }

      if (resAreas.success) {
        setAreas(resAreas.data);
        const targetId = keepTableId !== undefined ? keepTableId : selectedTable?.id;
        if (targetId) {
          let updatedTable: Table | null = null;
          resAreas.data.forEach((area: Area) => {
            const found = area.tables.find((t: Table) => t.id === targetId);
            if (found) updatedTable = found;
          });
          if (updatedTable) {
            setSelectedTable(updatedTable);
            if ((updatedTable as Table).currentOrder && (updatedTable as Table).currentOrder?.items) {
              const currentOrd = (updatedTable as Table).currentOrder!;
              setCartItems(currentOrd.items || []);
              setDiscountPercent(currentOrd.discountPercent || 0);
              setCustomerCount(currentOrd.customerCount || 2);
              setOrderNotes(currentOrd.notes || '');
              setOrderUpdatedAt(currentOrd.updatedAt || null);
            }
          }
        }
      }
      if (resCats.success) setCategories(resCats.data);
      if (resProds.success) setProducts(resProds.data);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu POS:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    loadData();
  }, []);

  // Handle Table Selection
  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
    setActiveTab('menu');

    if (table.currentOrder && table.currentOrder.items) {
      setCartItems(table.currentOrder.items);
      setDiscountPercent(table.currentOrder.discountPercent || 0);
      setCustomerCount(table.currentOrder.customerCount || 2);
      setOrderNotes(table.currentOrder.notes || '');
      setOrderUpdatedAt(table.currentOrder.updatedAt || null);
    } else {
      setCartItems([]);
      setDiscountPercent(0);
      setCustomerCount(2);
      setOrderNotes('');
      setOrderUpdatedAt(null);
    }
  };

  // Move or Merge Table
  const handleMoveTable = async () => {
    if (!selectedTable || !targetTableId) {
      addToast('warning', 'Vui lòng chọn bàn đích muốn chuyển hoặc gộp!');
      return;
    }

    setIsMovingTable(true);
    try {
      const res = await fetch('/api/tables/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTableId: selectedTable.id,
          toTableId: targetTableId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowMoveTableModal(false);
        setTargetTableId(null);
        addToast('success', data.message || 'Đã chuyển/gộp bàn thành công!');
        await loadData(targetTableId);
      } else {
        addToast('error', data.error || 'Lỗi khi chuyển bàn');
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Lỗi kết nối khi chuyển bàn');
    } finally {
      setIsMovingTable(false);
    }
  };

  // Add Item to Cart
  const handleAddToCart = (product: Product) => {
    if (!selectedTable) {
      addToast('warning', 'Vui lòng chọn Bàn trước khi gọi món!');
      setActiveTab('tables');
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            quantity: 1,
            note: '',
          },
        ];
      }
    });

    addToast('success', `Đã thêm +1 ${product.name} vào ${selectedTable.name}`);
  };

  // Update Cart Item Note
  const handleSaveItemNote = (productId: number, note: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, note } : item))
    );
    setEditingItemNote(null);
    addToast('info', 'Đã lưu ghi chú món');
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (productId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  // Calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.productPrice * item.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Save / Update Order
  const handleSaveOrder = async () => {
    if (!selectedTable) return;
    if (cartItems.length === 0) {
      addToast('warning', 'Giỏ hàng trống! Vui lòng chọn món.');
      return;
    }

    setSavingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          items: cartItems,
          customerCount,
          discountPercent,
          notes: orderNotes,
          updatedAt: orderUpdatedAt,
          version: selectedTable.currentOrder?.version,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.data && data.data.updatedAt) {
          setOrderUpdatedAt(data.data.updatedAt);
        }
        await loadData(selectedTable.id);
        setSavingOrder(false);
        addToast('success', `Đã lưu đơn thành công cho ${selectedTable.name}!`);
      } else {
        if (res.status === 409) {
           addToast('warning', 'Đơn hàng đã được thay đổi bởi người khác, tự động tải lại...');
           await loadData(selectedTable.id);
        } else {
          addToast('error', data.error || 'Lỗi khi lưu đơn');
        }
        setSavingOrder(false);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Lỗi kết nối máy chủ');
      setSavingOrder(false);
    }
  };

  // Execute Payment
  const handleExecutePayment = async () => {
    if (!selectedTable) return;

    setIsProcessingPay(true);
    try {
      // First save order to get orderId if new or updated
      let orderId = selectedTable.currentOrderId;
      const resSave = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          items: cartItems,
          customerCount,
          discountPercent,
          notes: orderNotes,
          version: selectedTable.currentOrder?.version,
        }),
      });
      const dataSave = await resSave.json();
      if (dataSave.success) {
        orderId = dataSave.data.orderId;
        if (dataSave.data.updatedAt) {
          setOrderUpdatedAt(dataSave.data.updatedAt);
        }
      } else {
        addToast('error', `[POST /api/orders FAILED ${resSave.status}] ${dataSave.error}`);
        if (resSave.status === 409) {
          addToast('warning', 'Đơn hàng đã được cập nhật bởi người khác, đang tải lại...');
          await loadData(selectedTable.id);
        }
        setIsProcessingPay(false);
        return;
      }

      if (!orderId) {
        addToast('error', 'Không thể xác định đơn hàng');
        setIsProcessingPay(false);
        return;
      }

      // Execute Pay API
      const resPay = await fetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          discountPercent,
          notes: orderNotes,
        }),
      });

      const dataPay = await resPay.json();
      if (dataPay.success) {
        setIsProcessingPay(false);
        setShowPaymentModal(false);
        addToast('success', `Đã thanh toán thành công ${selectedTable.name}!`);
        setPaidReceipt({
          tableName: selectedTable.name,
          orderId,
          subtotal,
          discountAmount,
          finalAmount: finalTotal,
          paymentMethod,
          receivedCash: Number(receivedCash || finalTotal),
          changeAmount: Math.max(0, Number(receivedCash || finalTotal) - finalTotal),
          items: [...cartItems],
          date: new Date().toLocaleString('vi-VN'),
        });
        setShowInvoiceModal(true);
        setCartItems([]);
        setSelectedTable(null);
        await loadData();
      } else {
        addToast('error', `[PAY API FAILED ${resPay.status}] ${dataPay.error}`);
        setIsProcessingPay(false);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Lỗi kết nối khi thanh toán');
      setIsProcessingPay(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    const matchSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const allTablesList = areas.flatMap((a) => a.tables).filter((t) => selectedTable && t.id !== selectedTable.id);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-4.25rem)] overflow-hidden">
        {/* ================= LEFT / MAIN CONTENT AREA (8 COLS) ================= */}
        <div className="lg:col-span-8 flex flex-col h-full gap-3 overflow-hidden">
          {/* Top Switcher Tabs: Table Map vs Product Menu */}
          <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('tables')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'tables'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>SƠ ĐỒ BÀN & KHU VỰC</span>
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'menu'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Beer className="w-4 h-4" />
                <span>THỰC ĐƠN & BIA</span>
                {selectedTable && (
                  <span className="bg-slate-950/40 text-amber-300 px-2 py-0.5 rounded-md text-[11px] ml-1 font-bold">
                    {selectedTable.name}
                  </span>
                )}
              </button>
            </div>

            {/* Area Filter Selector (If on Table View) */}
            {activeTab === 'tables' && (
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedAreaId('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedAreaId === 'all'
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tất cả khu vực
                </button>
                {areas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAreaId(a.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      selectedAreaId === a.id
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}

            {/* Search Bar (If on Menu View) */}
            {activeTab === 'menu' && (
              <div className="relative w-48 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm bia, món nhậu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ================= TAB 1: TABLE MAP GRID ================= */}
          {activeTab === 'tables' && (
            <div className="flex-1 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto">
              <div className="space-y-6">
                {areas
                  .filter((area) => selectedAreaId === 'all' || area.id === selectedAreaId)
                  .map((area) => (
                    <div key={area.id} className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          {area.name}
                        </h3>
                        <div className="text-xs text-slate-400">
                          {area.tables.filter((t) => t.status === 'occupied').length} / {area.tables.length} bàn có khách
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                        {area.tables.map((table) => {
                          const isOccupied = table.status === 'occupied' || !!table.currentOrder;
                          const isSelected = selectedTable?.id === table.id;

                          return (
                            <button
                              key={table.id}
                              onClick={() => handleSelectTable(table)}
                              className={`relative p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between h-28 group overflow-hidden ${
                                isSelected
                                  ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/50'
                                  : isOccupied
                                  ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400 amber-glow'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                              }`}
                            >
                              <div
                                className={`absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-20 -mr-6 -mt-6 rounded-full blur-xl ${
                                  isOccupied ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                              />

                              <div className="flex items-center justify-between w-full z-10">
                                <span className="font-extrabold text-sm text-white group-hover:text-amber-400 transition-colors">
                                  {table.name}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    isOccupied
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {isOccupied ? 'Có khách' : 'Trống'}
                                </span>
                              </div>

                              <div className="z-10 mt-auto">
                                {isOccupied && table.currentOrder ? (
                                  <div>
                                    <div className="text-xs font-black text-amber-400">
                                      {formatVND(table.currentOrder.finalAmount || table.currentOrder.totalAmount || 0)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Users className="w-3 h-3 text-slate-500" />
                                      {table.currentOrder.customerCount || table.seats} khách
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-slate-600" />
                                    {table.seats} chỗ ngồi
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ================= TAB 2: PRODUCT MENU GRID ================= */}
          {activeTab === 'menu' && (
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategoryId === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  🍺 Tất cả ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedCategoryId === cat.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="flex-1 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between group shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="aspect-video w-full rounded-lg bg-slate-800 overflow-hidden relative">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Beer className="w-8 h-8" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-amber-400 font-mono">
                          {product.unit}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                          {product.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{product.code}</div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-400">{formatVND(product.price)}</span>
                      <button className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center transition-all">
                        <Plus className="w-3.5 h-3.5 font-bold" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT PANEL: ORDER & BILLING (4 COLS) ================= */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl">
          {/* Order Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                <Beer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  {selectedTable ? selectedTable.name : 'CHƯA CHỌN BÀN'}
                </h2>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Khách:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={customerCount}
                    onChange={(e) => setCustomerCount(Number(e.target.value))}
                    className="w-12 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-center text-xs text-amber-300 font-bold"
                  />
                </div>
              </div>
            </div>

            {selectedTable && (
              <button
                onClick={() => setShowMoveTableModal(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1 transition-all border border-slate-700"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Chuyển / Gộp bàn</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 divide-y divide-slate-800/60">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                <Utensils className="w-12 h-12 text-slate-700 stroke-1 animate-pulse" />
                <p className="text-xs">Chưa có món ăn/bia nào được chọn.</p>
                <p className="text-[11px] text-slate-600">Chọn bàn và nhấn vào món ăn ở thực đơn để chọn món.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.productId} className="pt-2.5 first:pt-0 flex items-start justify-between gap-2 group">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{item.productName}</span>
                      <button
                        onClick={() =>
                          setEditingItemNote({
                            productId: item.productId,
                            productName: item.productName,
                            note: item.note || '',
                          })
                        }
                        className="text-slate-500 hover:text-amber-400 text-[10px] transition-colors"
                        title="Thêm ghi chú"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                    {item.note && (
                      <div className="text-[10px] text-amber-300/80 italic font-sans mt-0.5">
                        &bull; Ghi chú: {item.note}
                      </div>
                    )}
                    <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                      {formatVND(item.productPrice)}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="w-5 h-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-amber-400">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="w-5 h-5 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center transition-all font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Total item price */}
                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-bold text-white">{formatVND(item.productPrice * item.quantity)}</div>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, -item.quantity)}
                      className="text-rose-400 hover:text-rose-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary & Checkout Actions */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 space-y-3">
            {/* Discount Selector */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Giảm giá (%)</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      discountPercent === pct
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1.5 text-xs border-t border-slate-800/80 pt-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Tạm tính ({cartItems.length} món):</span>
                <span className="font-mono text-slate-200">{formatVND(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-rose-400">
                  <span>Giảm giá ({discountPercent}%):</span>
                  <span className="font-mono">-{formatVND(discountAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm font-extrabold text-white pt-1">
                <span>TỔNG CỘNG:</span>
                <span className="text-amber-400 text-base font-black font-mono">{formatVND(finalTotal)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleSaveOrder}
                disabled={savingOrder || !selectedTable}
                className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 border border-slate-700"
              >
                {savingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                <span>LƯU ĐƠN / BẾP</span>
              </button>

              <button
                onClick={() => {
                  if (!selectedTable) {
                    addToast('warning', 'Vui lòng chọn bàn!');
                    return;
                  }
                  setShowPaymentModal(true);
                }}
                disabled={cartItems.length === 0}
                className="py-3 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" />
                <span>THANH TOÁN</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ================= MOVE / MERGE TABLE MODAL ================= */}
      {showMoveTableModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" /> Chuyển hoặc Gộp Bàn
              </h3>
              <button onClick={() => setShowMoveTableModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-slate-300">
                Đang chọn: <span className="text-amber-400 font-bold">{selectedTable.name}</span>
              </p>
              <label className="block text-slate-400 font-semibold">Chọn bàn đích chuyển sang:</label>
              <select
                value={targetTableId || ''}
                onChange={(e) => setTargetTableId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
              >
                <option value="">-- Chọn bàn đích --</option>
                {allTablesList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status === 'occupied' ? 'Đã có khách - Gộp đơn' : 'Trống - Chuyển sang'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 italic">
                * Nếu chọn bàn đang có khách, hệ thống sẽ tự động gộp toàn bộ món ăn vào bàn đó.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowMoveTableModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={handleMoveTable}
                disabled={isMovingTable || !targetTableId}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {isMovingTable && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>XÁC NHẬN CHUYỂN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIETQR & PAYMENT MODAL ================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" /> Thanh toán {selectedTable?.name}
              </h3>
              <p className="text-xs text-slate-400">Chọn phương thức thanh toán để xuất hóa đơn</p>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'transfer'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-6 h-6 text-amber-400" />
                <span>Mã VietQR</span>
              </button>

              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Banknote className="w-6 h-6 text-emerald-400" />
                <span>Tiền mặt</span>
              </button>

              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-6 h-6 text-blue-400" />
                <span>Thẻ Quẹt POS</span>
              </button>
            </div>

            {/* VietQR Dynamic Code Display */}
            {paymentMethod === 'transfer' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center space-y-3">
                <div className="bg-white p-2.5 rounded-2xl shadow-xl flex justify-center items-center">
                  <Image
                    src={`https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${finalTotal}&addInfo=${encodeURIComponent(
                      `TT ${selectedTable?.name || ''}`
                    )}&accountName=${encodeURIComponent(bankConfig.accountName)}`}
                    alt="VietQR Payment Code"
                    width={192}
                    height={192}
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="text-slate-300 font-bold">
                    {bankConfig.bankId} &bull; <span className="font-mono">{bankConfig.accountNo}</span>
                  </div>
                  <div className="text-amber-400 font-semibold">Chủ TK: {bankConfig.accountName}</div>
                  <div className="text-[11px] text-slate-400">Quét mã QR bằng app Ngân hàng (Napas247)</div>
                </div>
              </div>
            )}

            {/* Cash Calculator & Quick Presets */}
            {paymentMethod === 'cash' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Tiền cần thanh toán:</span>
                  <span className="text-amber-400 font-black font-mono text-sm">{formatVND(finalTotal)}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tiền khách đưa (VND)</label>
                  <input
                    type="number"
                    value={receivedCash}
                    onChange={(e) => setReceivedCash(e.target.value)}
                    placeholder="VD: 500000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Cash Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setReceivedCash(finalTotal.toString())}
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-xs font-bold transition-all border border-amber-500/30"
                  >
                    Đủ tiền
                  </button>
                  {[100000, 200000, 500000, 1000000].map((denom) => (
                    <button
                      key={denom}
                      onClick={() => setReceivedCash(denom.toString())}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700 font-mono"
                    >
                      {formatVND(denom)}
                    </button>
                  ))}
                </div>

                {Number(receivedCash) > 0 && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-300 font-semibold">Tiền thối lại:</span>
                    <span className="text-emerald-400 font-black font-mono text-sm">
                      {formatVND(Math.max(0, Number(receivedCash) - finalTotal))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Total Amount Display & Final Pay Action */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Tổng thanh toán</div>
                <div className="text-xl font-black text-amber-400 font-mono">{formatVND(finalTotal)}</div>
              </div>

              <button
                onClick={handleExecutePayment}
                disabled={isProcessingPay}
                className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {isProcessingPay ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>HOÀN TẤT THANH TOÁN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INVOICE PRINT RECEIPT MODAL ================= */}
      {showInvoiceModal && paidReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl relative font-mono text-xs">
            <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-4">
              <h2 className="text-lg font-extrabold uppercase">{bankConfig.shopName}</h2>
              <p className="text-[11px] text-slate-600">ĐC: {bankConfig.shopAddress}</p>
              <p className="text-[11px] text-slate-600">Hotline: {bankConfig.shopPhone}</p>
              <div className="font-bold pt-2 text-sm text-amber-800">HÓA ĐƠN TÍNH TIỀN</div>
              <div className="text-[10px] text-slate-500">Mã HD: #{paidReceipt.orderId} &bull; {paidReceipt.date}</div>
            </div>

            <div className="flex justify-between font-bold border-b border-dashed border-slate-300 pb-2">
              <span>Bàn: {paidReceipt.tableName}</span>
              <span>PTTT: {paidReceipt.paymentMethod === 'transfer' ? 'VietQR' : paidReceipt.paymentMethod === 'cash' ? 'Tiền mặt' : 'Thẻ'}</span>
            </div>

            {/* Items */}
            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              <div className="grid grid-cols-12 font-bold text-slate-700">
                <span className="col-span-6">Tên món</span>
                <span className="col-span-2 text-center">SL</span>
                <span className="col-span-4 text-right">Thành tiền</span>
              </div>
              {paidReceipt.items.map((item, idx: number) => (
                <div key={idx} className="grid grid-cols-12 text-slate-800">
                  <span className="col-span-6 truncate">
                    {item.productName}
                    {item.note && <span className="block text-[9px] text-slate-500 italic">({item.note})</span>}
                  </span>
                  <span className="col-span-2 text-center">{item.quantity}</span>
                  <span className="col-span-4 text-right">{formatVND(item.productPrice * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="space-y-1 font-bold pt-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tạm tính:</span>
                <span>{formatVND(paidReceipt.subtotal || paidReceipt.finalAmount)}</span>
              </div>
              {paidReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-rose-600">
                  <span>Giảm giá:</span>
                  <span>-{formatVND(paidReceipt.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-300">
                <span>TỔNG CỘNG:</span>
                <span>{formatVND(paidReceipt.finalAmount)}</span>
              </div>
              {paidReceipt.paymentMethod === 'cash' && paidReceipt.receivedCash > 0 && (
                <div className="pt-1 text-[11px] text-slate-600 flex justify-between font-normal">
                  <span>Tiền nhận: {formatVND(paidReceipt.receivedCash)}</span>
                  <span>Tiền thối: {formatVND(paidReceipt.changeAmount || 0)}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-4 border-t border-dashed border-slate-400 space-y-1 text-[11px] text-slate-600">
              <p>Cảm ơn Quý khách & Hẹn gặp lại!</p>
              <p className="text-[9px] text-slate-400">Powered by Bia Club POS</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> In hóa đơn
              </button>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ITEM NOTE MODAL ================= */}
      {editingItemNote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Ghi chú: {editingItemNote.productName}</h3>
              <button onClick={() => setEditingItemNote(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={editingItemNote.note}
              onChange={(e) => setEditingItemNote({ ...editingItemNote, note: e.target.value })}
              placeholder="VD: Không đá, Mang ra sau, Chín kỹ..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingItemNote(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={() => handleSaveItemNote(editingItemNote.productId, editingItemNote.note)}
                className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
