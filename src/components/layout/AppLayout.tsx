// ============================================
// Court Access — App Layout (Sidebar + Header + Content)
// Unified design language — Program 6
// ============================================

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';
import { SURFACES } from '../../constants/designTokens';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={SURFACES.page}>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar />
      </div>

      <div className="lg:ml-64 min-h-screen flex flex-col">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="px-6 lg:px-8 py-4 border-t border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>CourtAccess — Criminal Evidence Intelligence Platform</span>
            <span>AI-generated insights are not legal advice. Consult your attorney.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
