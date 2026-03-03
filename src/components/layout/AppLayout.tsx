// ============================================
// Court Access — App Layout (Sidebar + Header + Content)
// ============================================

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <footer className="px-6 py-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Court Access — Case Intelligence Platform</span>
            <span>AI-generated insights are not legal advice. Consult your attorney.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
