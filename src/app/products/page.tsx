'use client';

import { useState, useEffect } from 'react';
import { UtensilsCrossed, Plus, Search, Beer, Trash2, X, CheckCircle2, Edit2, AlertCircle, Save } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import Image from 'next/image';

import ToastContainer, { ToastMessage } from '@/components/Toast';

interface Product {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  price: number;
  costPrice: number;
  unit: string;
  stockQuantity: number;
  imageUrl: string;
  categoryName: string;
  isAvailable: boolean;
}

interface Category {
  id: number;
  name: string;
}

export default function ProductsPage() {
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

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [price, setPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [unit, setUnit] = useState('Đĩa');
  const [stockQuantity, setStockQuantity] = useState('100');
  const [imageUrl, setImageUrl] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [resP, resC] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
      ]);

      if (resP.success) setProducts(resP.data);
      if (resC.success) {
        setCategories(resC.data);
        if (resC.data.length > 0) setCategoryId(resC.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    loadData();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setName('');
    setPrice('');
    setCostPrice('');
    setUnit('Đĩa');
    setStockQuantity('100');
    setImageUrl('');
    if (categories.length > 0) setCategoryId(categories[0].id);
    setShowAddModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditId(p.id);
    setName(p.name);
    setPrice(p.price.toString());
    setCostPrice((p.costPrice || 0).toString());
    setUnit(p.unit);
    setStockQuantity((p.stockQuantity || 0).toString());
    setImageUrl(p.imageUrl || '');
    setCategoryId(p.categoryId);
    setShowAddModal(true);
  };

  const handleAddOrEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      addToast('warning', 'Vui lòng nhập tên món và giá bán');
      return;
    }

    try {
      const method = editId ? 'PUT' : 'POST';
      const body = {
        id: editId,
        categoryId,
        name,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        unit,
        stockQuantity: Number(stockQuantity || 100),
        imageUrl: imageUrl || undefined,
      };

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        addToast('success', editId ? 'Đã cập nhật món ăn!' : 'Đã thêm món ăn mới!');
        await loadData();
      } else {
        addToast('error', data.error || 'Lỗi khi xử lý món ăn');
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn NGỪNG BÁN món này?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Đã tạm ngưng bán món ăn');
        await loadData();
      } else {
        addToast('error', data.error);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Lỗi kết nối');
    }
  };

  const handleRestoreProduct = async (id: number) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isAvailable: true }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Đã mở bán lại món ăn');
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const matchSearch =
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <>
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-amber-400" /> QUẢN LÝ THỰC ĐƠN & BIA
            </h1>
            <p className="text-xs text-slate-400 mt-1">Sửa đổi thông tin, cập nhật giá bán, ngừng kinh doanh thực đơn</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm bia, món nhậu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={openAddModal}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 font-black" />
              <span>THÊM MÓN MỚI</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCat === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tất cả ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCat === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
          {loading ? (
            Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3 animate-pulse h-60 flex flex-col justify-between">
                <div className="aspect-video w-full rounded-xl bg-slate-800/80"></div>
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-slate-800/80 rounded"></div>
                  <div className="h-4 w-32 bg-slate-800/80 rounded"></div>
                  <div className="h-4 w-20 bg-slate-800/80 rounded"></div>
                </div>
                <div className="h-8 w-full bg-slate-800/80 rounded-xl"></div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 font-medium">
              Không tìm thấy món ăn nào phù hợp.
            </div>
          ) : (
            filtered.map((product) => {
            const isInactive = product.isAvailable === false;

            return (
              <div
                key={product.id}
                className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group h-fit ${
                  isInactive ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100' : 'hover:border-amber-500/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="aspect-video w-full rounded-xl bg-slate-800 overflow-hidden relative">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Beer className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] text-amber-400 font-mono font-bold">
                      {product.unit}
                    </span>
                    {isInactive && (
                      <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center backdrop-blur-[1px]">
                        <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-1 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> NGỪNG BÁN
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{product.categoryName}</div>
                      <h3 className="text-sm font-extrabold text-white transition-colors mt-0.5">
                        {product.name}
                      </h3>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">Mã: {product.code}</div>
                    </div>

                    {/* Admin Actions (Edit/Delete) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/50 rounded-lg p-1 backdrop-blur-md border border-slate-800">
                      <button 
                        onClick={() => openEditModal(product)} 
                        className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
                        title="Sửa món"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      
                      {isInactive ? (
                        <button 
                          onClick={() => handleRestoreProduct(product.id)}
                          className="p-1.5 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors"
                          title="Bán lại món này"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                          title="Ngừng bán"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-black font-mono ${isInactive ? 'text-slate-400 line-through' : 'text-amber-400'}`}>
                      {formatVND(product.price)}
                    </div>
                    <div className="text-[10px] text-slate-500">Giá vốn: {formatVND(product.costPrice || 0)}</div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">Kho: {product.stockQuantity}</div>
                </div>
              </div>
            );
          }))}
        </div>
      </main>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-400" /> {editId ? 'Sửa Yết Món/Bia' : 'Thêm Món/Bia Mới'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOrEditProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Danh mục</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white outline-none focus:border-amber-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tên món / Tên loại bia</label>
                <input
                  type="text"
                  placeholder="VD: Bia Trúc Bạch (Chai)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Giá bán (VND)</label>
                  <input
                    type="number"
                    placeholder="VD: 30000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none font-mono focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Giá vốn nhập (VND)</label>
                  <input
                    type="number"
                    placeholder="VD: 18000"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    placeholder="Cốc, Chai, Đĩa, Nồi..."
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Số lượng tồn kho (ảo)</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Link Ảnh (URL)</label>
                <input
                  type="url"
                  placeholder="VD: https://example.com/image.jpg (Bỏ trống sẽ dùng ảnh mặc định)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 rounded-xl font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 rounded-xl font-extrabold shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  {editId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editId ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
