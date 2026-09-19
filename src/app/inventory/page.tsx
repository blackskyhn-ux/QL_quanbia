'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Package, AlertTriangle, Beer, CheckCircle2, Search } from 'lucide-react';
// import { formatVND } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  code: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  categoryName: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProducts(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const lowStock = products.filter((p) => p.stockQuantity <= (p.minStockLevel || 10));

  const filtered = products.filter(
    (p) =>
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-400" /> QUẢN LÝ KHO HÀNG & NGUYÊN LIỆU
            </h1>
            <p className="text-xs text-slate-400 mt-1">Theo dõi số lượng tồn kho các loại bia chai, lon, nước ngọt và nguyên liệu nhậu</p>
          </div>

          {lowStock.length > 0 && (
            <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{lowStock.length} sản phẩm sắp hết hàng!</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Inventory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Mã Hàng</th>
                  <th className="p-4">Tên Sản Phẩm</th>
                  <th className="p-4">Danh Mục</th>
                  <th className="p-4">Đơn Vị</th>
                  <th className="p-4">Tồn Kho Hiện Tại</th>
                  <th className="p-4">Ngưỡng Cảnh Báo</th>
                  <th className="p-4">Trạng Thái Kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((product) => {
                  const isLow = product.stockQuantity <= (product.minStockLevel || 10);

                  return (
                    <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-amber-400">{product.code}</td>
                      <td className="p-4 font-bold text-white">{product.name}</td>
                      <td className="p-4 text-slate-400">{product.categoryName}</td>
                      <td className="p-4 font-mono text-slate-300">{product.unit}</td>
                      <td className="p-4 font-mono font-extrabold text-white text-sm">{product.stockQuantity}</td>
                      <td className="p-4 font-mono text-slate-400">{product.minStockLevel || 10}</td>
                      <td className="p-4">
                        {isLow ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3" /> Cần nhập thêm
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3" /> An toàn
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
