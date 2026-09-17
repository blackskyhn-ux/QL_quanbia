'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Beer, Lock, User, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Đăng nhập không thành công');
        setLoading(false);
        return;
      }

      router.push('/pos');
      router.refresh();
    } catch (err) {
      setError('Đã xảy ra lỗi kết nối máy chủ. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#070a12] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Ambient Blur background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-xl amber-glow">
            <Beer className="w-10 h-10 animate-bounce" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            QUÁN BIA <span className="text-amber-400">CLUB POS</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Hệ thống Quản lý Bán hàng & Ca làm việc chuyên nghiệp</p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 border border-slate-800 shadow-2xl relative backdrop-blur-xl">
          <div className="mb-6 border-b border-slate-800/80 pb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" /> Đăng nhập hệ thống
            </h2>
            <p className="text-xs text-slate-400 mt-1">Nhập tài khoản thu ngân hoặc quản lý để tiếp tục</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: admin hoặc thungan1"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Đang xác thực...
                </>
              ) : (
                'VÀO MÀN HÌNH BÁN HÀNG POS'
              )}
            </button>
          </form>

          {/* Quick Login Demo Accounts */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-center text-slate-400 mb-3 font-medium">
              ⚡ Điền nhanh tài khoản thử nghiệm:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123')}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 text-xs text-slate-300 hover:text-amber-400 text-left transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Admin</div>
                  <div className="text-[10px] text-slate-400">admin / admin123</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('thungan1', 'cashier123')}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 text-xs text-slate-300 hover:text-amber-400 text-left transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">Thu Ngân</div>
                  <div className="text-[10px] text-slate-400">thungan1 / cashier123</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; 2026 Bia Club POS &bull; Enterprise Billiards & Beer POS System
        </p>
      </div>
    </div>
  );
}
