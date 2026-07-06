// ============================================
// Court Access — Header Component (dark)
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
    <header className="h-16 ca-glass-nav flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={handleSearch} className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="Search cases, statutes, citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 lg:w-96 pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-navy-900/60 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-shadow"
            aria-label="Search"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/faq"
          className="hidden md:flex p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Help"
        >
          <HelpCircle size={20} />
        </Link>

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-light rounded-full ring-2 ring-navy-800" />
        </button>

        {user && (
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 pl-3 ml-1 border-l border-white/10 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 ca-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <span className="text-navy text-sm font-bold">{user.name.charAt(0)}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
