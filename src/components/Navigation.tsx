import { Sparkles, User, LogOut, Lock, Home, Bot, ChevronRight, Settings, LayoutDashboard, CreditCard, Sun, Moon, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PoddleMark from './PoddleMark';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface NavigationProps {
  currentPage: string;
  onNavigate: (
    page: string,
    podId?: string,
    userId?: string,
    editMode?: boolean,
    initialTab?: string,
    threadId?: string,
    initialAssumptionId?: string,
    postId?: string,
  ) => void;
}

const NAV_ITEMS_AUTH = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'workspaces', label: 'Workspaces', icon: Lock },
];

const NAV_ITEMS_GUEST = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'ai-feed', label: 'AI Feed', icon: Bot },
];

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email?: string } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setUserProfile(null); return; }
    supabase
      .from('profiles')
      .select('is_admin, full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin || false);
        setUserProfile({ full_name: data?.full_name || null, email: user.email });
      })
      .catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
      setShowLogoutConfirm(false);
    }
  }, [isSigningOut, signOut]);

  const handleNavigate = useCallback((page: string) => {
    if (page === 'admin') {
      window.location.hash = 'admin';
    } else {
      onNavigate(page);
    }
  }, [onNavigate]);

  const navItems = user ? NAV_ITEMS_AUTH : NAV_ITEMS_GUEST;

  // Determine active item
  const activeId = (currentPage === 'workspace-hub' || currentPage === 'workspace-settings')
    ? 'workspaces'
    : currentPage === 'auth' ? 'home' : currentPage;

  const displayName = userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Account';
  const displayEmail = userProfile?.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* ── Desktop left sidebar (lg+, authenticated only) ── */}
      {user && (
        <aside
          aria-label="Sidebar navigation"
          className="hidden xl:flex flex-col fixed top-0 left-0 bottom-0 z-50 w-60"
          style={{
            background: '#0f172a',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 h-16 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <PoddleMark size={28} />
            <span className="text-base font-black text-white tracking-tight">Poddle AI</span>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto" role="list">
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 py-2" style={{ color: 'rgba(100,116,139,0.8)' }}>Navigation</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
                  style={isActive ? {
                    background: 'rgba(37,99,235,0.18)',
                    color: '#93c5fd',
                  } : {
                    color: 'rgba(148,163,184,0.85)',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.85)'; } }}
                >
                  {isActive && <span className="absolute left-0 w-0.5 h-5 rounded-r-full bg-blue-400" aria-hidden="true" />}
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                </button>
              );
            })}

            {isAdmin && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-4 pb-2" style={{ color: 'rgba(100,116,139,0.8)' }}>Admin</p>
                <button
                  onClick={() => handleNavigate('admin')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{ color: 'rgba(251,191,36,0.9)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  <span>Admin Panel</span>
                </button>
              </>
            )}
          </nav>

          {/* User footer */}
          <div className="flex-shrink-0 px-3 pb-4 pt-2 border-t space-y-0.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => handleNavigate('profile')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: activeId === 'profile' ? '#93c5fd' : 'rgba(148,163,184,0.85)', background: activeId === 'profile' ? 'rgba(37,99,235,0.18)' : '' }}
              onMouseEnter={e => { if (activeId !== 'profile') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
              onMouseLeave={e => { if (activeId !== 'profile') { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.85)'; } }}
            >
              <User className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              <span>Account Settings</span>
            </button>
            <button
              onClick={() => handleNavigate('pricing')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: activeId === 'pricing' ? '#93c5fd' : 'rgba(148,163,184,0.85)', background: activeId === 'pricing' ? 'rgba(37,99,235,0.18)' : '' }}
              onMouseEnter={e => { if (activeId !== 'pricing') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
              onMouseLeave={e => { if (activeId !== 'pricing') { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.85)'; } }}
            >
              <CreditCard className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              <span>Plans &amp; Billing</span>
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ color: 'rgba(148,163,184,0.85)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.85)'; }}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                : <Moon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              }
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <div className="flex items-center gap-3 p-3 rounded-xl mt-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>{displayEmail}</p>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                disabled={isSigningOut}
                aria-label="Sign out"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                style={{ color: 'rgba(148,163,184,0.5)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.5)'; }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Top bar ── */}
      {/* On desktop + authenticated: slim top bar spanning right of sidebar */}
      {/* On mobile / guest: full-width top bar */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${user ? 'xl:left-60' : ''}`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: theme === 'dark'
            ? (scrolled ? 'rgba(18,18,20,0.98)' : 'rgba(18,18,20,0.92)')
            : (scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.82)'),
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
          boxShadow: scrolled ? '0 2px 16px rgba(15,23,42,0.06)' : 'none',
        }}
      >
        <div className={`${user ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          <div className="flex items-center justify-between h-14 gap-3">

            {/* LEFT: logo (mobile) or page title (desktop authenticated) */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Logo — mobile + guest always; hidden on xl when authenticated (sidebar has it) */}
              <button
                onClick={() => onNavigate(user ? 'workspaces' : 'home')}
                aria-label="Go to home"
                className={`flex items-center gap-2 flex-shrink-0 focus-visible:outline-none rounded-lg hover:opacity-80 active:opacity-70 transition-opacity ${user ? 'xl:hidden' : ''}`}
              >
                <PoddleMark size={26} />
                <span
                  className="text-[15px] font-black tracking-tight"
                  style={{ color: theme === 'dark' ? '#f4f4f5' : '#0f172a' }}
                >
                  Poddle AI
                </span>
              </button>

              {/* Desktop authenticated only: page breadcrumb */}
              {user && (
                <div className="hidden xl:flex items-center gap-3">
                  <h2 className="text-sm font-semibold capitalize" style={{ color: theme === 'dark' ? '#a1a1aa' : '#334155' }}>
                    {currentPage === 'workspace-hub' || currentPage === 'workspace-settings'
                      ? 'Workspaces'
                      : currentPage === 'home' ? 'Dashboard'
                      : currentPage.replace(/-/g, ' ')}
                  </h2>
                </div>
              )}

              {/* Guest center nav links (desktop) */}
              {!user && (
                <div className="hidden md:flex items-center gap-1 flex-1 justify-center" role="list">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        role="listitem"
                        onClick={() => handleNavigate(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className="relative flex items-center gap-2 h-9 px-3 rounded-xl transition-all duration-200"
                        style={isActive ? {
                          background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
                          color: '#fff',
                          boxShadow: '0 3px 10px rgba(37,99,235,0.3)',
                        } : { color: '#475569' }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.05)'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: action icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Authenticated mobile icon row */}
              {user ? (
                <div className="flex items-center gap-0.5 xl:hidden">
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
                    style={{ color: theme === 'dark' ? '#71717a' : '#64748b' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#fbbf24' : '#d97706'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#71717a' : '#64748b'; }}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onNavigate('profile')}
                    aria-label="Account settings"
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
                    style={{ color: theme === 'dark' ? '#71717a' : '#64748b' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLElement).style.color = '#2563eb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#71717a' : '#64748b'; }}
                  >
                    <User className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={isSigningOut}
                    aria-label="Sign out"
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 disabled:opacity-50"
                    style={{ color: theme === 'dark' ? '#71717a' : '#64748b' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#71717a' : '#64748b'; }}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('slack')}
                    className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-600 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Slack
                  </button>
                  <a
                    href="https://chromewebstore.google.com/detail/poddle-lens/pdcllidghoikeoamjebjgdlgjaccfmmn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-600 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    Poddle Lens
                  </a>
                  <button
                    onClick={() => onNavigate('auth')}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-600 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => onNavigate('auth')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Join free</span>
                    <span className="sm:hidden">Join</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Guest mobile bottom bar ── */}
      {!user && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 -4px 20px rgba(15,23,42,0.1)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => onNavigate('auth')}
              className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              Join free — it's instant
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="py-3 px-4 rounded-2xl text-slate-600 font-semibold text-sm bg-slate-100 active:bg-slate-200 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* ── Authenticated mobile bottom nav ── */}
      {user && (
        <nav
          aria-label="Mobile navigation"
          className="xl:hidden fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: theme === 'dark' ? 'rgba(18,18,20,0.98)' : 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 -2px 20px rgba(15,23,42,0.08)',
          }}
        >
          <div className="flex items-stretch" role="list" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => handleNavigate(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-all duration-200 active:scale-95 touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(37,99,235,0.1)' }}
                    />
                  )}
                  <Icon
                    className="relative z-10 transition-all duration-200"
                    style={{
                      width: '1.375rem',
                      height: '1.375rem',
                      color: isActive ? '#2563eb' : (theme === 'dark' ? '#52525b' : '#94a3b8'),
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className="relative z-10 text-[11px] leading-none font-semibold"
                    style={{ color: isActive ? '#2563eb' : (theme === 'dark' ? '#52525b' : '#94a3b8') }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '1.5rem', height: '2.5px', background: 'linear-gradient(90deg,#2563eb,#06b6d4)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          className="fixed inset-0 flex items-center justify-center z-[70] p-4"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl max-w-sm w-full p-6"
            style={{
              background: theme === 'dark' ? '#18181b' : '#fff',
              boxShadow: '0 24px 64px rgba(15,23,42,0.2)',
              border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 id="logout-title" className="text-lg font-bold" style={{ color: theme === 'dark' ? '#f4f4f5' : '#0f172a' }}>Sign Out</h3>
                <p className="text-sm" style={{ color: theme === 'dark' ? '#71717a' : '#64748b' }}>You'll need to sign in again</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                style={{
                  border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  color: theme === 'dark' ? '#a1a1aa' : '#334155',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
              >
                {isSigningOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
