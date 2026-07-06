// ============================================
// Court Access — Header Component
// Unified design language — Program 2
// ============================================

import { Search, Bell, Menu, HelpCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useState } from 'react';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-30 shadow-card">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 text-slate-500 hover:text-navy rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={handleSearch} className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search cases, documents, statutes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 lg:w-96 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/30 transition-shadow"
            aria-label="Search"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/faq"
          className="hidden md:flex p-2 text-slate-500 hover:text-navy rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Help"
        >
          <HelpCircle size={20} />
        </Link>

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-slate-500 hover:text-navy rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        {user && (
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-200 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 bg-navy rounded-xl flex items-center justify-center shadow-card">
              <span className="text-white text-sm font-semibold">{user.name.charAt(0)}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-navy">{user.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
