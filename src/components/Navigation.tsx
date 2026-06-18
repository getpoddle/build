import { Sparkles, User, LogOut, Search, Bell, X, Bot, Lock, Home, Inbox } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Notifications from './Notifications';
import UnifiedSearch from './UnifiedSearch';
import MobileNotificationsContent from './MobileNotificationsSheet';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { throttle } from '../lib/throttle';

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
  { id: 'workspaces', label: 'Workspaces', icon: Lock },
  { id: 'my-inbox', label: 'Inbox', icon: Inbox },
  { id: 'profile', label: 'Profile', icon: User },
];

const NAV_ITEMS_GUEST = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'ai-feed', label: 'AI Feed', icon: Bot },
];

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const [mobileUnreadCount, setMobileUnreadCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.is_admin || false))
      .catch(() => setIsAdmin(false));
  }, [user]);

  const fetchMobileUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setMobileUnreadCount(count || 0);
    } catch {}
  }, [user]);

  const throttledFetchCount = useMemo(
    () => throttle(fetchMobileUnreadCount, 1000),
    [fetchMobileUnreadCount]
  );

  useEffect(() => {
    if (!user) return;
    fetchMobileUnreadCount();
    const channel = supabase
      .channel('mobile-notifications-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, throttledFetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, throttledFetchCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowMobileNotifications(false);
        setShowLogoutConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

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

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          borderBottom: scrolled ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(15,23,42,0.04)',
          boxShadow: scrolled ? '0 4px 24px rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6 flex-1 md:gap-8">
              <button
                onClick={() => onNavigate(user ? 'workspaces' : 'home')}
                aria-label="Go to home"
                className="flex items-center gap-3 group flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-xl font-black hidden sm:block" style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Poddle
                </span>
              </button>

              <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-1 justify-center" role="list">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      role="listitem"
                      onClick={() => handleNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className="relative flex items-center gap-2 h-10 px-3 lg:px-4 rounded-xl transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                      style={isActive ? {
                        background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
                        color: '#fff',
                        boxShadow: '0 3px 12px rgba(37,99,235,0.35)',
                      } : { color: '#475569' }}
                    >
                      {!isActive && (
                        <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: 'rgba(15,23,42,0.05)' }} aria-hidden="true" />
                      )}
                      <Icon className="relative z-10 transition-transform duration-200 group-hover:scale-110" style={{ width: '1.125rem', height: '1.125rem' }} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                      <span className="relative z-10 text-sm font-semibold whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    onClick={() => handleNavigate('admin')}
                    className="flex items-center h-10 px-3 lg:px-4 rounded-xl transition-all duration-200 text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                  >
                    <span className="text-sm font-bold">Admin</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {user && (
                <button
                  onClick={() => setShowSearch(true)}
                  aria-label="Search (Cmd+K)"
                  className="flex items-center gap-2 w-auto px-3 py-2 text-slate-500 hover:text-slate-700 rounded-xl transition-all duration-200 hover:bg-slate-100/80 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                >
                  <Search className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
                  <span className="hidden sm:block text-xs text-slate-400 border border-slate-200 rounded-lg px-1.5 py-0.5 font-mono" aria-hidden="true">⌘K</span>
                </button>
              )}
              {user ? (
                <>
                  <button
                    onClick={() => setShowMobileNotifications(true)}
                    aria-label={mobileUnreadCount > 0 ? `Notifications — ${mobileUnreadCount} unread` : 'Notifications'}
                    aria-haspopup="dialog"
                    className="md:hidden relative flex items-center justify-center w-10 h-10 text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  >
                    <Bell style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
                    {mobileUnreadCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute flex items-center justify-center text-white font-black rounded-full"
                        style={{
                          top: '6px',
                          right: '6px',
                          background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                          minWidth: '1rem',
                          height: '1rem',
                          fontSize: '9px',
                          padding: '0 2px',
                          boxShadow: '0 2px 6px rgba(220,38,38,0.4)',
                        }}
                      >
                        {mobileUnreadCount > 9 ? '9+' : mobileUnreadCount}
                      </span>
                    )}
                  </button>
                  <div className="hidden md:block">
                    <Notifications onNavigate={onNavigate} />
                  </div>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={isSigningOut}
                    aria-label="Sign out"
                    className="flex items-center justify-center w-10 h-10 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                  >
                    <LogOut style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('auth')}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-600 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => onNavigate('auth')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                  >
                    <Sparkles style={{ width: '0.875rem', height: '0.875rem' }} aria-hidden="true" />
                    <span className="hidden sm:inline">Join free</span>
                    <span className="sm:hidden">Join</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

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
              className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              Join free — it's instant
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="py-3 px-4 rounded-2xl text-slate-600 font-semibold text-sm bg-slate-100 active:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {user && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            borderTop: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 -2px 20px rgba(15,23,42,0.08)',
          }}
        >
          <div
            className="flex items-stretch"
            role="list"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => handleNavigate(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-all duration-200 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:bg-blue-50"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '2.5rem', height: '2.5rem', background: 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(6,182,212,0.12))', backdropFilter: 'blur(4px)' }}
                    />
                  )}
                  <Icon
                    aria-hidden="true"
                    className="relative z-10 transition-all duration-200"
                    style={{
                      width: '1.375rem',
                      height: '1.375rem',
                      color: isActive ? '#2563eb' : '#94a3b8',
                      transform: isActive ? 'scale(1.08) translateY(-1px)' : 'scale(1)',
                    }}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className="relative z-10 text-[11px] leading-none font-semibold transition-colors duration-200"
                    style={{ color: isActive ? '#2563eb' : '#94a3b8' }}
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

      {showMobileNotifications && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          className="fixed inset-0 z-[60] flex flex-col justify-end"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobileNotifications(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
              </div>
              <button
                onClick={() => setShowMobileNotifications(false)}
                aria-label="Close notifications"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <MobileNotificationsContent
                onNavigate={(page) => { setShowMobileNotifications(false); onNavigate(page); }}
                onUnreadCountChange={setMobileUnreadCount}
              />
            </div>
          </div>
        </div>
      )}

      {showSearch && <UnifiedSearch onClose={() => setShowSearch(false)} onNavigate={onNavigate} />}

      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          className="fixed inset-0 flex items-center justify-center z-[70] p-4"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 animate-scale-in" style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <LogOut className="w-5 h-5 text-red-600" aria-hidden="true" />
              </div>
              <div>
                <h3 id="logout-title" className="text-lg font-bold text-slate-900">Sign Out</h3>
                <p className="text-sm text-slate-500">You'll need to sign in again</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
