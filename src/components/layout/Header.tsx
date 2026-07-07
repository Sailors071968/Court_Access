// ============================================
// Court Access — Header Component (dark)
// Upper-right account menu — Master Collaboration System Program (Phase 5)
// ============================================

import { useEffect, useRef, useState } from 'react';
import {
  Search, Bell, Menu, HelpCircle, Command, ChevronDown,
  User, UserCircle, Users, Building2, Bell as BellIcon, CreditCard, Sparkles, Shield, LifeBuoy, LogOut,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGlobalSearch } from '../search/GlobalSearch';
import { Avatar } from '../ui/avatar';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { open: openSearch } = useGlobalSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const go = (to: string) => () => { setMenuOpen(false); navigate(to); };

  const primaryItems: MenuItem[] = [
    { label: 'Profile', icon: <User size={16} />, to: '/settings#profile' },
    { label: 'My Account', icon: <UserCircle size={16} />, to: '/settings' },
    { label: 'Collaborators', icon: <Users size={16} />, to: '/collaborators' },
    { label: 'Firm Settings', icon: <Building2 size={16} />, to: '/firm' },
    { label: 'Notifications', icon: <BellIcon size={16} />, to: '/notifications' },
    { label: 'Billing', icon: <CreditCard size={16} />, to: '/settings#billing' },
    { label: 'Subscription', icon: <Sparkles size={16} />, to: '/settings#billing' },
    { label: 'Security', icon: <Shield size={16} />, to: '/settings#security' },
    { label: 'Help', icon: <LifeBuoy size={16} />, to: '/faq' },
  ];

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
          <div className="relative pl-2 ml-1 border-l border-white/10" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/5 transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" accent />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white leading-tight">{user.name}</p>
                <p className="text-xs text-slate-400 capitalize leading-tight">{user.role.replace(/_/g, ' ')}</p>
              </div>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-navy-800/95 backdrop-blur-xl shadow-elevated overflow-hidden animate-fade-in z-50"
              >
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <Avatar name={user.name} src={user.avatarUrl} size="md" accent />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="py-1.5">
                  {primaryItems.map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={go(item.to!)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <span className="text-slate-400">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/10 py-1.5">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
