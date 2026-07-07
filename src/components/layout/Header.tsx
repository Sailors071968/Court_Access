// ============================================
// Court Access — Header Component (dark)
// Unified design language — Program 2
// ============================================

import { Search, Bell, Menu, HelpCircle, Command } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGlobalSearch } from '../search/GlobalSearch';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { open: openSearch } = useGlobalSearch();

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

        {/* Primary navigation experience — opens the global command palette */}
        <button
          onClick={openSearch}
          className="hidden sm:flex items-center gap-3 w-72 lg:w-96 pl-3 pr-2 py-2.5 rounded-xl border border-white/10 bg-navy-900/60 text-sm text-slate-400 hover:border-gold/30 hover:text-slate-300 transition-colors"
          aria-label="Open global search"
        >
          <Search size={16} className="text-slate-400" />
          <span className="flex-1 text-left">Search cases, statutes, citations…</span>
          <kbd className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10">
            <Command size={10} />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={openSearch}
          className="sm:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Search"
        >
          <Search size={20} />
        </button>
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
