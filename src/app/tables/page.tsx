'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Users, Edit2, Trash2, ShieldCog, Save } from 'lucide-react';
import { formatVND } from '@/lib/utils';
import Link from 'next/link';

import ToastContainer, { ToastMessage } from '@/components/Toast';

interface Area {
  id: number;
  name: string;
  isActive: boolean;
  tables: Table[];
}

interface Table {
  id: number;
  areaId: number;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  currentOrderId: number | null;
  currentOrder?: {
    finalAmount?: number;
    totalAmount?: number;
    customerCount?: number;
  };
}

export default function TablesPage() {
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

  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | 'all'>('all');
  
  // Admin Editing Mode
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Modals
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingAreaInfo, setEditingAreaInfo] = useState<{ id?: number, name: string }>({ name: '' });
  const [editingTableInfo, setEditingTableInfo] = useState<{ id?: number, areaId: number, name: string, seats: number }>({ areaId: 0, name: '', seats: 4 });

  const loadAreas = async () => {
    try {
      const res = await fetch('/api/areas');
      const data = await res.json();
      if (data.success) {
        setAreas(data.data);
        if (selectedAreaId !== 'all' && !data.data.find((a: Area) => a.id === selectedAreaId)) {
          setSelectedAreaId('all');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user.roleName === 'admin') setIsAdmin(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    loadAreas();
  }, []);

  const totalTables = areas.reduce((acc, a) => acc + a.tables.length, 0);
  const occupiedTables = areas.reduce((acc, a) => acc + a.tables.filter((t) => t.status === 'occupied').length, 0);
  const availableTables = totalTables - occupiedTables;

  // -- Area Management --
  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAreaInfo.name) return;
    const method = editingAreaInfo.id ? 'PUT' : 'POST';
    try {
      const res = await fetch('/api/areas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAreaInfo)
      });
      const data = await res.json();
      if (data.success) {
        setShowAreaModal(false);
        addToast('success', editingAreaInfo.id ? 'Đã cập nhật khu vực thành công' : 'Đã thêm khu vực mới');
        await loadAreas();
      } else addToast('error', data.error);
    } catch { addToast('error', 'Lỗi lưu khu vực'); }
  };

  const handleDeleteArea = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn ngưng hoạt động khu vực này? Các bàn bên trong cũng sẽ không hiển thị.')) return;
    try {
      const res = await fetch(`/api/areas?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Đã tạm ngưng khu vực');
        await loadAreas();
      } else addToast('error', data.error);
    } catch { addToast('error', 'Lỗi khi xóa khu vực'); }
  };

  // -- Table Management --
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTableInfo.name || !editingTableInfo.areaId) return;
    const method = editingTableInfo.id ? 'PUT' : 'POST';
    try {
      const res = await fetch('/api/tables', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTableInfo)
      });
      const data = await res.json();
      if (data.success) {
        setShowTableModal(false);
        addToast('success', editingTableInfo.id ? 'Đã cập nhật bàn thành công' : 'Đã tạo bàn mới');
        await loadAreas();
      } else addToast('error', data.error);
    } catch { addToast('error', 'Lỗi lưu bàn'); }
  };

  const handleDeleteTable = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xoá bàn này?')) return;
    try {
      const res = await fetch(`/api/tables?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Đã xoá bàn thành công');
        await loadAreas();
      } else addToast('error', data.error);
    } catch { addToast('error', 'Lỗi kết nối'); }
  };

  return (
    <>
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Stats Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-amber-400" /> SƠ ĐỒ BÀN & QUẢN LÝ KHU VỰC
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Theo dõi trạng thái tất cả các bàn ăn/nhậu theo khu vực realtime
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400">
              Trống: {availableTables} bàn
            </div>
            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400">
              Có khách: {occupiedTables} bàn
            </div>
            {isAdmin && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  editMode 
                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-amber-500/50'
                }`}
              >
                <ShieldCog className="w-4 h-4" />
                {editMode ? 'Thoát Chế Độ Sửa' : 'Sửa Sơ Đồ'}
              </button>
            )}
          </div>
        </div>

        {/* Filter Area Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedAreaId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              selectedAreaId === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tất cả khu vực ({areas.length})
          </button>
          
          {areas.map((area) => (
            <button
              key={area.id}
              onClick={() => setSelectedAreaId(area.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedAreaId === area.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {area.name} ({area.tables.length})
            </button>
          ))}
          
          {editMode && (
            <button
              onClick={() => {
                setEditingAreaInfo({ name: '' });
                setShowAreaModal(true);
              }}
              className="px-3 py-2 border border-dashed border-amber-500/50 text-amber-500 hover:bg-amber-500/10 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm Khu
            </button>
          )}
        </div>

        {/* Area & Tables List */}
        <div className="space-y-8">
          {areas
            .filter((a) => selectedAreaId === 'all' || a.id === selectedAreaId)
            .map((area) => (
              <div key={area.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <h2 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    {area.name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      {area.tables.filter((t) => t.status === 'occupied').length} đang dùng / {area.tables.length} bàn
                    </span>
                    {editMode && (
                      <div className="flex bg-slate-900 rounded-lg border border-slate-700/50 overflow-hidden">
                        <button onClick={() => {
                          setEditingTableInfo({ areaId: area.id, name: '', seats: 4 });
                          setShowTableModal(true);
                        }} className="px-2 py-1 text-xs text-amber-400 hover:bg-slate-800 flex items-center gap-1"><Plus className="w-3 h-3"/> Bàn</button>
                        <button onClick={() => {
                          setEditingAreaInfo({ id: area.id, name: area.name });
                          setShowAreaModal(true);
                        }} className="px-2 py-1 text-xs text-sky-400 hover:bg-slate-800 border-l border-slate-700/50"><Edit2 className="w-3 h-3"/></button>
                        <button onClick={() => handleDeleteArea(area.id)} className="px-2 py-1 text-xs text-rose-400 hover:bg-slate-800 border-l border-slate-700/50"><Trash2 className="w-3 h-3"/></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {area.tables.map((table) => {
                    const isOccupied = table.status === 'occupied' || !!table.currentOrder;

                    // If not in edit mode, links to POS
                    return editMode ? (
                      <div
                        key={table.id}
                        className="p-4 rounded-2xl border text-left bg-slate-900 border-slate-700 border-dashed flex flex-col justify-between h-36 relative overflow-hidden group"
                      >
                         <div className="flex items-center justify-between w-full">
                          <span className="font-black text-sm text-slate-300 group-hover:text-amber-400 transition-colors">
                            {table.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{table.seats} ghế</span>
                        </div>
                        <div className="mt-auto grid grid-cols-2 gap-2">
                           <button onClick={() => {
                             setEditingTableInfo({ id: table.id, areaId: area.id, name: table.name, seats: table.seats });
                             setShowTableModal(true);
                           }} className="py-1.5 bg-sky-500/10 text-sky-400 rounded hover:bg-sky-500/20 text-xs flex justify-center"><Edit2 className="w-3.5 h-3.5"/></button>
                           <button onClick={() => handleDeleteTable(table.id)} className="py-1.5 bg-rose-500/10 text-rose-400 rounded hover:bg-rose-500/20 text-xs flex justify-center"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                    ) : (
                      <Link
                        key={table.id}
                        href="/pos"
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between h-36 relative overflow-hidden group ${
                          isOccupied
                            ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 amber-glow'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-sm text-white group-hover:text-amber-400 transition-colors">
                            {table.name}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isOccupied
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isOccupied ? 'Có khách' : 'Trống'}
                          </span>
                        </div>

                        <div className="mt-auto space-y-1">
                          {isOccupied && table.currentOrder ? (
                             <div>
                               <div className="text-xs font-black text-amber-400">
                                 {formatVND(table.currentOrder.finalAmount || table.currentOrder.totalAmount || 0)}
                               </div>
                               <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                 <Users className="w-3 h-3 text-slate-500" /> {table.currentOrder.customerCount || 2} khách
                               </div>
                             </div>
                          ) : (
                             <div className="text-[11px] text-slate-500 flex items-center gap-1">
                               <Users className="w-3 h-3 text-slate-600" /> {table.seats} chỗ ngồi
                             </div>
                          )}

                          <div className="text-[10px] text-amber-500/90 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            <span>Mở POS gọi món &rarr;</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      </main>

      {/* Edit Area Modal */}
      {showAreaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <LayoutGrid className="w-5 h-5 text-amber-400" /> {editingAreaInfo.id ? 'Cập Nhật Khu Vực' : 'Thêm Khu Vực Mới'}
            </h3>
            <form onSubmit={handleSaveArea} className="space-y-4 text-sm mt-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Tên khu vực</label>
                <input required type="text" value={editingAreaInfo.name} onChange={e => setEditingAreaInfo({...editingAreaInfo, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" placeholder="Sân vườn, Lầu 1..."/>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAreaModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 text-xs">Huỷ</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold flex items-center gap-1 text-xs"><Save className="w-3.5 h-3.5"/> Lưu Layout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="w-5 h-5 text-amber-400" /> {editingTableInfo.id ? 'Thuộc tính Bàn' : 'Thêm Bàn Mới'}
            </h3>
            <form onSubmit={handleSaveTable} className="space-y-4 text-sm mt-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Khu vực</label>
                <select value={editingTableInfo.areaId} onChange={e => setEditingTableInfo({...editingTableInfo, areaId: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none">
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Tên Bàn/Ký hiệu</label>
                  <input required type="text" value={editingTableInfo.name} onChange={e => setEditingTableInfo({...editingTableInfo, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" placeholder="Bàn 1..."/>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Sức chứa (Ghế)</label>
                  <input required type="number" min="1" value={editingTableInfo.seats} onChange={e => setEditingTableInfo({...editingTableInfo, seats: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTableModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 text-xs">Huỷ</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold flex items-center gap-1 text-xs"><Save className="w-3.5 h-3.5"/> Lưu Bàn</button>
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
