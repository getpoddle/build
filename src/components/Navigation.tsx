import { User, Users, LogOut, Lock, Home, Bot, ChevronRight, ChevronLeft, Settings, LayoutDashboard, CreditCard, Sun, Moon, Building2, Map, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PoddleMark from './PoddleMark';
import Notifications from './Notifications';
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
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  hideDashboard?: boolean;
}

const NAV_ITEMS_AUTH = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'workspaces', label: 'Workspaces', icon: Lock },
];

const NAV_ITEMS_GUEST = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'team', label: 'Team', icon: Users },
];

export default function Navigation({ currentPage, onNavigate, collapsed = false, onToggleCollapsed, hideDashboard = false }: NavigationProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
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
    Promise.all([
      supabase.rpc('get_own_profile_sensitive').maybeSingle(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
    ]).then(([sensitiveRes, profileRes]) => {
      setIsAdmin(sensitiveRes.data?.is_admin || false);
      setUserProfile({ full_name: profileRes.data?.full_name || null, email: user.email });
    }).catch(() => setIsAdmin(false));

    supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .then(({ data }) => setIsOrgAdmin(!!data && data.length > 0))
      .catch(() => setIsOrgAdmin(false));
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

  const navItemsAuth = [...NAV_ITEMS_AUTH, { id: 'decision-map', label: 'Decision Map', icon: Map }, { id: 'decision-trail', label: 'Decision Trail', icon: BookOpen }, { id: 'organization', label: 'Organization', icon: Building2 }];
  const navItems = user
    ? (hideDashboard ? navItemsAuth.filter(i => i.id !== 'home') : navItemsAuth)
    : NAV_ITEMS_GUEST;
  const activeId = (currentPage === 'workspace-hub' || currentPage === 'workspace-settings')
    ? 'workspaces'
    : currentPage === 'auth' ? 'home' : currentPage;

  const displayName = userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Account';
  const displayEmail = userProfile?.email || '';
  const initials = displayName.slice(0, 2).toUpperCase();

  const sidebarWidth = collapsed ? '4rem' : '15rem';
  const isDark = theme === 'dark';

  return (
    <>
      {user && (
        <style>{`
          @media (min-width: 1280px) {
            .xl-sidebar-offset { left: ${sidebarWidth} !important; transition: left 220ms cubic-bezier(0.4,0,0.2,1); }
            .xl-sidebar-margin { margin-left: ${sidebarWidth} !important; transition: margin-left 220ms cubic-bezier(0.4,0,0.2,1); }
          }
        `}</style>
      )}
      {/* ── Desktop left sidebar (xl+, authenticated only) ── */}
      {user && (
        <aside
          aria-label="Sidebar navigation"
          className="hidden xl:flex flex-col fixed top-0 left-0 bottom-0 z-50 overflow-hidden"
          style={{
            width: collapsed ? '4rem' : '15rem',
            transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
            background: 'var(--app-nav-bg)',
            borderRight: '1px solid var(--app-border)',
          }}
        >
          {/* Logo row */}
          <div
            className="flex items-center h-16 flex-shrink-0 border-b"
            style={{ borderColor: 'var(--app-border)', padding: collapsed ? '0 1rem' : '0 1.25rem', justifyContent: collapsed ? 'center' : 'flex-start', gap: '0.625rem' }}
          >
            <PoddleMark size={28} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-base font-black tracking-tight whitespace-nowrap overflow-hidden">
                <span style={{ color: 'var(--signal)', fontWeight: 700 }}>Poddle</span><span style={{ color: 'var(--app-text-muted)', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
              </span>
            )}
            {onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="flex items-center justify-center w-6 h-6 rounded-lg transition-all flex-shrink-0"
                style={{
                  marginLeft: collapsed ? 0 : 'auto',
                  color: 'var(--app-text-muted)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
              >
                <ChevronLeft
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
            )}
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? '0.5rem 0.5rem' : '0.5rem 0.75rem' }} role="list">
            {!collapsed && (
              <p className="text-[11px] font-bold uppercase tracking-widest px-3 py-2 whitespace-nowrap" style={{ color: 'var(--app-text-muted)' }}>Navigation</p>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className="relative w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    gap: collapsed ? 0 : '0.75rem',
                    padding: collapsed ? '0.625rem' : '0.625rem 0.75rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    ...(isActive ? { background: 'var(--signal-bg)', color: 'var(--signal)' } : { color: 'var(--app-text-secondary)' }),
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; } }}
                >
                  {isActive && !collapsed && <span className="absolute left-0 w-0.5 h-5 rounded-full" style={{ background: 'var(--signal)' }} aria-hidden="true" />}
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  {!collapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
                  {!collapsed && isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60 flex-shrink-0" />}
                </button>
              );
            })}

            {isAdmin && (
              <>
                {!collapsed && (
                  <p className="text-[11px] font-bold uppercase tracking-widest px-3 pt-4 pb-2 whitespace-nowrap" style={{ color: 'var(--app-text-muted)' }}>Admin</p>
                )}
                <button
                  onClick={() => handleNavigate('admin')}
                  title={collapsed ? 'Admin Panel' : undefined}
                  className="w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    gap: collapsed ? 0 : '0.75rem',
                    padding: collapsed ? '0.625rem' : '0.625rem 0.75rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: 'var(--caution)',
                    marginTop: collapsed ? '0.5rem' : 0,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--caution-bg, rgba(217,119,6,0.10))'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap">Admin Panel</span>}
                </button>
              </>
            )}
          </nav>

          {/* User footer */}
          <div
            className="flex-shrink-0 pt-2 border-t"
            style={{ borderColor: 'var(--app-border)', padding: collapsed ? '0.5rem' : '0.5rem 0.75rem 1rem' }}
          >
            {!collapsed ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-0.5 px-1 pb-1">
                  <Notifications onNavigate={onNavigate} />
                  <button
                    onClick={() => handleNavigate('profile')}
                    aria-label="Account Settings"
                    title="Account Settings"
                    className="flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                    style={{ color: activeId === 'profile' ? 'var(--signal)' : 'var(--app-text-secondary)', background: activeId === 'profile' ? 'var(--signal-bg)' : '' }}
                    onMouseEnter={e => { if (activeId !== 'profile') (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                    onMouseLeave={e => { if (activeId !== 'profile') { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; } }}
                  >
                    <User className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                    <span>Account Settings</span>
                  </button>
                </div>
                <button
                  onClick={() => handleNavigate('pricing')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{ color: activeId === 'pricing' ? 'var(--signal)' : 'var(--app-text-secondary)', background: activeId === 'pricing' ? 'var(--signal-bg)' : '' }}
                  onMouseEnter={e => { if (activeId !== 'pricing') (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                  onMouseLeave={e => { if (activeId !== 'pricing') { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; } }}
                >
                  <CreditCard className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                  <span>Plans &amp; Billing</span>
                </button>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{ color: 'var(--app-text-secondary)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; }}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 flex-shrink-0" strokeWidth={2} /> : <Moon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />}
                  <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>
                <div className="flex items-center gap-3 p-3 rounded-lg mt-1" style={{ background: 'var(--app-surface-raised)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: 'var(--signal)' }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text-primary)' }}>{displayName}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--app-text-muted)' }}>{displayEmail}</p>
                  </div>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={isSigningOut}
                    aria-label="Sign out"
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--negative-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--negative)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Notifications onNavigate={onNavigate} />
                <button
                  onClick={() => handleNavigate('profile')}
                  title="Account Settings"
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: activeId === 'profile' ? 'var(--signal)' : 'var(--app-text-muted)', background: activeId === 'profile' ? 'var(--signal-bg)' : '' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = activeId === 'profile' ? 'var(--signal-bg)' : ''; (e.currentTarget as HTMLElement).style.color = activeId === 'profile' ? 'var(--signal)' : 'var(--app-text-muted)'; }}
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: 'var(--app-text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mt-1" style={{ background: 'var(--app-surface-raised)' }}>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={isSigningOut}
                    title="Sign out"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--negative-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--negative)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Top bar ── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 right-0 z-50 transition-all duration-300${user ? ' xl-sidebar-offset' : ''}`}
        style={{
          left: 0,
          paddingTop: 'env(safe-area-inset-top)',
          background: isDark
            ? (scrolled ? 'rgba(18,18,20,0.98)' : 'rgba(18,18,20,0.92)')
            : (scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.82)'),
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--app-border)',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        }}
      >
        <div className={`${user ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          <div className="flex items-center justify-between h-14 gap-3">

            {/* LEFT: logo (mobile) or page title (desktop authenticated) */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => onNavigate(user ? 'workspaces' : 'home')}
                aria-label="Go to home"
                className={`flex items-center gap-2 flex-shrink-0 focus-visible:outline-none rounded-lg hover:opacity-80 active:opacity-70 transition-opacity ${user ? 'xl:hidden' : ''}`}
              >
                <PoddleMark size={26} />
                <span
                  className="text-[15px] font-black tracking-tight"
                  style={{ color: isDark ? '#f4f4f5' : '#0f172a' }}
                >
                  <span style={{ color: 'var(--signal)', fontWeight: 700 }}>Poddle</span><span style={{ color: isDark ? '#a1a1aa' : '#64748b', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
                </span>
              </button>

              {user && (
                <div className="hidden xl:flex items-center gap-3">
                  <h2 className="text-sm font-semibold capitalize" style={{ color: 'var(--app-text-secondary)' }}>
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
                        className="relative flex items-center gap-2 h-9 px-3 rounded-lg transition-all duration-200"
                        style={isActive ? {
                          background: 'var(--signal-bg)',
                          color: 'var(--signal)',
                        } : { color: 'var(--app-text-secondary)' }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; }}
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
              {user ? (
                <div className="flex items-center gap-0.5 xl:hidden">
                  <Notifications onNavigate={onNavigate} />
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onNavigate('profile')}
                    aria-label="Account settings"
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--signal)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                  >
                    <User className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={isSigningOut}
                    aria-label="Sign out"
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 disabled:opacity-50"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--negative-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--negative)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('auth')}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{ color: 'var(--app-text-secondary)', border: '1px solid var(--app-border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-raised)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => onNavigate('auth')}
                    className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:-translate-y-px"
                    style={{ background: 'var(--signal)', boxShadow: 'var(--shadow-signal)' }}
                  >
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
            borderTop: '1px solid var(--app-border)',
            boxShadow: 'var(--shadow-lg)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => onNavigate('auth')}
              className="flex-1 py-2.5 text-xs font-black uppercase tracking-wide transition-all active:scale-95 btn-primary"
              style={{ justifyContent: 'center' }}
            >
              Join free
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="py-2.5 px-4 text-xs font-semibold transition-colors btn-ghost"
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
            background: isDark ? 'rgba(18,18,20,0.98)' : 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--app-border)',
            boxShadow: 'var(--shadow-md)',
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
                  className="relative flex-1 flex flex-col items-center justify-center py-2.5 min-h-[56px] transition-all duration-200 active:scale-95 touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '2.5rem', height: '2.5rem', background: 'var(--signal-bg)' }}
                    />
                  )}
                  <Icon
                    className="relative z-10 transition-all duration-200"
                    style={{
                      width: '1.625rem',
                      height: '1.625rem',
                      color: isActive ? 'var(--signal)' : 'var(--app-text-muted)',
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '1.5rem', height: '2px', background: 'var(--signal)' }}
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
            className="rounded-xl max-w-sm w-full p-6"
            style={{
              background: 'var(--app-surface)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--app-border)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--negative-bg)' }}>
                <LogOut className="w-5 h-5" style={{ color: 'var(--negative)' }} />
              </div>
              <div>
                <h3 id="logout-title" className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>Sign Out</h3>
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>You'll need to sign in again</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                style={{
                  border: '1px solid var(--app-border)',
                  color: 'var(--app-text-secondary)',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-raised)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                style={{ background: 'var(--negative)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
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
