'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Beer,
  LayoutGrid,
  ClipboardList,
  UtensilsCrossed,
  BarChart3,
  Package,
  LogOut,
  Clock,
  UserCheck,
  Settings,
  Menu,
  X,
  User,
} from 'lucide-react';

import ShiftModal from '@/components/ShiftModal';

interface UserData {
  id: number;
  username: string;
  fullName: string;
  roleName: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [time, setTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [shiftModalOpen, setShiftModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // Clock
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // Fetch user info
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {});

    return () => clearInterval(timer);
  }, [pathname]);

  // Close mobile menu on page navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/pos', label: 'POS Bán Hàng', icon: Beer },
    { href: '/tables', label: 'Sơ Đồ Bàn', icon: LayoutGrid },
    { href: '/orders', label: 'Đơn Hàng', icon: ClipboardList },
    { href: '/products', label: 'Thực Đơn', icon: UtensilsCrossed },
    { href: '/reports', label: 'Báo Cáo', icon: BarChart3 },
    { href: '/inventory', label: 'Kho Hàng', icon: Package },
  ];

  if (user?.roleName === 'admin') {
    navItems.push(
      { href: '/users', label: 'Nhân Sự', icon: UserCheck },
      { href: '/settings', label: 'Cài Đặt', icon: Settings }
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/80 shadow-xl select-none">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo Branding */}
        <Link href="/pos" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
            <Beer className="w-5 h-5 sm:w-6 sm:h-6 font-extrabold" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1">
              BIA CLUB <span className="text-amber-400">POS</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-amber-500/80 uppercase font-semibold tracking-wider">
              Management System
            </div>
          </div>
        </Link>

        {/* Center Desktop Navigation Links (No horizontal scrollbar, compact design) */}
        <nav className="hidden xl:flex items-center gap-1.5 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Compact Navigation for Medium Screens (lg to xl) */}
        <nav className="hidden lg:flex xl:hidden items-center gap-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className="truncate max-w-[85px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Tools & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Shift Management Button */}
          <button
            onClick={() => setShiftModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-all"
            title="Quản Lý Ca Làm Việc"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Mở / Chốt Ca</span>
          </button>

          {/* Realtime Clock */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{time}</span>
          </div>

          {/* User Badge */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shadow-inner">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="hidden 2xl:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">{user.fullName}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user.roleName || 'Thu ngân'}</div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="hidden sm:flex p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700/80 hover:border-rose-500/50 text-slate-300 hover:text-rose-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Menu Button Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:text-amber-400 transition-all focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay / Dropdown (Clean Grid layout, zero horizontal scrollbar) */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 hover:border-amber-500/40 hover:bg-slate-850'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">{time}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-rose-400 font-semibold hover:text-rose-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}

      <ShiftModal isOpen={shiftModalOpen} onClose={() => setShiftModalOpen(false)} />
    </header>
  );
}

