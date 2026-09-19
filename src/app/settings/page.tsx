'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Store, CreditCard, Building2, MapPin, Phone, User as UserIcon, Settings, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    shop_name: '',
    shop_address: '',
    shop_phone: '',
    vietqr_bank_id: '',
    vietqr_account_no: '',
    vietqr_account_name: ''
  });

  // Example subset of popular banks in Vietnam for VietQR
  const banks = [
    { code: '970415', shortName: 'VietinBank' },
    { code: '970436', shortName: 'Vietcombank' },
    { code: '970418', shortName: 'BIDV' },
    { code: '970405', shortName: 'Agribank' },
    { code: '970422', shortName: 'MBBank' },
    { code: '970407', shortName: 'Techcombank' },
    { code: '970416', shortName: 'ACB' },
    { code: '970432', shortName: 'VPBank' },
    { code: '970423', shortName: 'TPBank' },
    { code: '970403', shortName: 'Sacombank' },
    { code: '970448', shortName: 'OCB' },
    { code: '970427', shortName: 'VietABank' },
    { code: '970426', shortName: 'MSB' }
  ];

  useEffect(() => {
    // 1. Fetch user to verify admin role
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.success || data.user.roleName !== 'admin') {
           router.push('/pos');
        }
      });

    // 2. Fetch settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setFormData(prev => ({ ...prev, ...data.settings }));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Đã lưu cấu hình thành công!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Đã có lỗi xảy ra' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-[calc(100vh-64px)] flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-amber-500" />
              Cài Đặt Hệ Thống
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Chỉ Admin mới có quyền truy cập và thay đổi các cấu hình cốt lõi của quán.
            </p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </div>

        {/* Global Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 font-semibold ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Shop Information Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-full -z-10 group-hover:bg-sky-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Thông Tin Quán</h2>
                <p className="text-xs text-slate-400 mt-0.5">Xuất hiện trên hoá đơn và giao diện chính</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <Building2 className="w-4 h-4 text-slate-400" /> Tên Quán Bia
                </label>
                <input
                  type="text"
                  name="shop_name"
                  value={formData.shop_name}
                  onChange={handleChange}
                  placeholder="Ví dụ: Bia Club Cơ Sở 1"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <MapPin className="w-4 h-4 text-slate-400" /> Địa Chỉ
                </label>
                <input
                  type="text"
                  name="shop_address"
                  value={formData.shop_address}
                  onChange={handleChange}
                  placeholder="Ví dụ: 123 Đường Nhậu, Quận 1, TP HCM"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <Phone className="w-4 h-4 text-slate-400" /> Điện Thoại Liên Hệ
                </label>
                <input
                  type="text"
                  name="shop_phone"
                  value={formData.shop_phone}
                  onChange={handleChange}
                  placeholder="Ví dụ: 0987 654 321"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Payment & VietQR Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -z-10 group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Cấu Hình Thanh Toán / VietQR</h2>
                <p className="text-xs text-slate-400 mt-0.5">Sử dụng để tạo mã QR Code chuyển khoản tự động</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <Building2 className="w-4 h-4 text-slate-400" /> Ngân Hàng Nhận Tiền
                </label>
                <select
                  name="vietqr_bank_id"
                  value={formData.vietqr_bank_id}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
                >
                  <option value="" disabled>-- Chọn Ngân Hàng --</option>
                  {banks.map(b => (
                    <option key={b.code} value={b.code}>{b.shortName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <CreditCard className="w-4 h-4 text-slate-400" /> Số Tài Khoản Ngân Hàng
                </label>
                <input
                  type="text"
                  name="vietqr_account_no"
                  value={formData.vietqr_account_no}
                  onChange={handleChange}
                  placeholder="Ví dụ: 19039328238..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors font-mono tracking-wider"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <UserIcon className="w-4 h-4 text-slate-400" /> Tên Chủ Tài Khoản
                </label>
                <input
                  type="text"
                  name="vietqr_account_name"
                  value={formData.vietqr_account_name}
                  onChange={handleChange}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors uppercase"
                />
                <p className="text-xs text-slate-500 mt-2 italic">Lưu ý: Tên chủ tài khoản thường viết hoa chữ cái, không dấu.</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
