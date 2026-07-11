// ============================================
// Court Access — App Layout (Sidebar + Header + Content)
// Unified dark design language — Program 6
// ============================================

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';
import { TrustBar } from '../brand/TrustBar';
import { GlobalSearchProvider } from '../search/GlobalSearch';
import { ToastProvider } from '../ui/toast';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ToastProvider>
    <GlobalSearchProvider>
      <div className="min-h-screen bg-navy-800 text-slate-200">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
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
          <TrustBar />
          <footer className="px-6 lg:px-8 py-3 border-t border-white/5 bg-navy-900/60">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
              <span>CourtAccess — Criminal Case Intelligence Platform</span>
              <span>AI-generated insights are not legal advice. Consult your attorney.</span>
            </div>
          </footer>
        </div>
      </div>
    </GlobalSearchProvider>
    </ToastProvider>
  );
}
