'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#090d16] text-slate-100 font-sans">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />
      <div className="flex-1 page-transition flex flex-col w-full">
        {children}
      </div>
    </div>
  );
}
