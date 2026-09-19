'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { UserCheck, Edit2, ShieldAlert, CheckCircle2, ShieldOff, Plus, Save } from 'lucide-react';

import ToastContainer, { ToastMessage } from '@/components/Toast';

interface User {
  id: number;
  username: string;
  fullName: string;
  phone: string;
  status: 'active' | 'inactive';
  roleId: number;
  roleName: string;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
}

export default function UsersPage() {
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

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    roleId: 2,
    status: 'active'
  });

  const loadData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/roles').then(r => r.json())
      ]);
      if (uRes.success) setUsers(uRes.data);
      if (rRes.success) setRoles(rRes.data);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    loadData();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData({ username: '', password: '', fullName: '', phone: '', roleId: 2, status: 'active' });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setFormData({
      username: u.username,
      password: '',
      fullName: u.fullName,
      phone: u.phone || '',
      roleId: u.roleId,
      status: u.status
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const body = { ...formData, id: editingId };
    
    try {
      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        addToast('success', editingId ? 'Cập nhật tài khoản thành công!' : 'Tạo tài khoản thành công!');
        loadData();
      } else {
        addToast('error', data.error);
      }
    } catch (e: unknown) {
      addToast('error', 'Lỗi kết nối máy chủ');
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch('/api/users', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id, status: newStatus })
      });
      if ((await res.json()).success) {
        addToast('info', `Đã ${newStatus === 'active' ? 'mở khóa' : 'khóa'} tài khoản`);
        loadData();
      }
    } catch (e: unknown) {}
  };

  if (loading) return <div className="min-h-screen bg-[#090d16] text-white flex items-center justify-center">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-amber-400" /> QUẢN LÝ NHÂN SỰ
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Phân quyền và quản lý tài khoản đăng nhập của nhân viên
            </p>
          </div>
          
          <button onClick={openAdd} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 font-extrabold text-slate-950 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20">
            <Plus className="w-4 h-4"/> THÔNG TIN TÀI KHOẢN MỚI
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 overflow-hidden rounded-2xl shadow-xl">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 border-b border-slate-800 text-xs font-bold text-slate-300">
              <tr>
                <th className="px-6 py-4">Họ và tên</th>
                <th className="px-6 py-4">Tên đăng nhập</th>
                <th className="px-6 py-4">SĐT</th>
                <th className="px-6 py-4">Phân quyền</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold">{u.fullName}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono">{u.username}</td>
                  <td className="px-6 py-4 text-slate-400">{u.phone || '---'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      u.roleName === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      {u.roleName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 w-max ${
                      u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {u.status === 'active' ? <CheckCircle2 className="w-3 h-3"/> : <ShieldOff className="w-3 h-3"/>}
                      {u.status === 'active' ? 'Hoạt động' : 'Khoá'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => openEdit(u)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg" title="Sửa thông tin"><Edit2 className="w-3.5 h-3.5"/></button>
                    {u.roleName !== 'admin' && ( // Don't allow locking themselves intuitively
                      <button onClick={() => toggleStatus(u.id, u.status)} className={`p-1.5 rounded-lg ${u.status === 'active' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`} title={u.status === 'active' ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}>
                        {u.status === 'active' ? <ShieldAlert className="w-3.5 h-3.5"/> : <CheckCircle2 className="w-3.5 h-3.5"/>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Auth Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserCheck className="w-5 h-5 text-amber-400" /> {editingId ? 'Cập nhật tài khoản' : 'Tạo tài khoản mới'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-4 text-sm mt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Tên đăng nhập (Bắt buộc)</label>
                    <input disabled={!!editingId} required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">{editingId ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}</label>
                    <input required={!editingId} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" />
                  </div>
               </div>

               <div>
                 <label className="block text-slate-400 text-xs mb-1">Họ tên (Bắt buộc)</label>
                 <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Số điện thoại</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Vai trò / Phân quyền</label>
                    <select value={formData.roleId} onChange={e => setFormData({...formData, roleId: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500">
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name} - {r.description}</option>)}
                    </select>
                  </div>
               </div>

               <div className="flex justify-end gap-2 pt-2">
                 <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 text-xs">Huỷ</button>
                 <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold flex items-center gap-1 text-xs"><Save className="w-3.5 h-3.5"/> Lưu tài khoản</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
