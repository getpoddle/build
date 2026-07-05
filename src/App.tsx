import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react';
import { CheckCircle, Mail, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary, { PageErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './lib/supabase';
import { updatePageSEO, injectNoIndex } from './lib/seo';
import { pageview } from './lib/analytics';
import Auth from './pages/Auth';
import Home from './pages/Home';
import GuestHome from './pages/GuestHome';
import Navigation from './components/Navigation';
import InstallPrompt from './components/InstallPrompt';
import { ToastContainer, useToast } from './components/Toast';
import { useBetaAccess } from './hooks/useBetaAccess';
import BetaAccessBanner from './components/BetaAccessBanner';

const Profile = lazy(() => import('./pages/Profile'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PublicAssumption = lazy(() => import('./pages/PublicAssumption'));
const PublicPost = lazy(() => import('./pages/PublicPost'));
const AppIcons = lazy(() => import('./pages/AppIcons'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Pricing = lazy(() => import('./pages/Pricing'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const WorkspaceHub = lazy(() => import('./pages/WorkspaceHub'));
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'));
const JoinWorkspace = lazy(() => import('./pages/JoinWorkspace'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const ExtensionView = lazy(() => import('./pages/ExtensionView'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const { user, loading, isPasswordRecovery, clearPasswordRecovery, signupEmailPending, clearSignupEmailPending, resendConfirmation } = useAuth();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResend = async () => {
    if (!signupEmailPending || resendCooldown > 0) return;
    setResending(true);
    await resendConfirmation(signupEmailPending);
    setResending(false);
    setResendSent(true);
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);
  const { toasts, dismissToast, addToast } = useToast();

  // Fire any pending Slack OAuth result toasts after the handler is registered
  useEffect(() => {
    const connected = sessionStorage.getItem('slackConnectedToast');
    const error = sessionStorage.getItem('slackErrorToast');
    if (connected) {
      sessionStorage.removeItem('slackConnectedToast');
      addToast('success', 'Slack connected successfully!');
    } else if (error) {
      sessionStorage.removeItem('slackErrorToast');
      const readable = error === 'not_configured' ? 'Slack is not configured yet.' : `Slack connection failed: ${error}`;
      addToast('error', readable);
    }
  }, [addToast]);
  const [currentPage, setCurrentPage] = useState(() => {
    if (window.location.pathname === '/extension-view') return 'extension-view';
    const hash = window.location.hash.substring(1);
    if (hash === 'admin' || hash === 'admin-panel' || hash === 'app-icons') {
      return hash;
    }
    if (hash === 'blog') return 'blog';
    if (hash.startsWith('blog/')) return 'blog-post';
    const saved = sessionStorage.getItem('currentPage');
    if (!saved || saved === 'auth' || saved === 'home') return 'workspaces';
    return saved;
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    const saved = sessionStorage.getItem('selectedUserId');
    return saved || null;
  });
  const [assumptionId, setAssumptionId] = useState<string | null>(null);
  const [publicPostId, setPublicPostId] = useState<string | null>(null);
  const [publicDiscussionId, setPublicDiscussionId] = useState<string | null>(null);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [highlightDiscussionId, setHighlightDiscussionId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const onboardingCheckedRef = useRef(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [blogSlug, setBlogSlug] = useState<string | null>(() => {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('blog/')) return hash.slice('blog/'.length) || null;
    return null;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('poddle_referral', refCode);
    }

    if (window.location.pathname === '/extension-view') {
      setCurrentPage('extension-view');
      return;
    }

    if (urlParams.get('payment_success') === '1') {
      setCurrentPage('payment-success');
      return;
    }

    // Slack OAuth return: /?workspace=<id>&slack_connected=1  or  /?slack_error=<reason>
    const slackConnected = urlParams.get('slack_connected');
    const slackError = urlParams.get('slack_error');
    const slackWorkspaceId = urlParams.get('workspace');
    if (slackConnected === '1' && slackWorkspaceId) {
      // Clean the URL then navigate to workspace settings
      history.replaceState(null, '', `#workspace-settings/${slackWorkspaceId}`);
      setWorkspaceId(slackWorkspaceId);
      setCurrentPage('workspace-settings');
      sessionStorage.setItem('slackConnectedToast', '1');
      return;
    }
    if (slackError) {
      history.replaceState(null, '', '/');
      sessionStorage.setItem('slackErrorToast', slackError);
    }

    // Slack "View Full War Room" deep-link: /?workspace=<id>
    const deepLinkWorkspaceId = urlParams.get('workspace');
    if (deepLinkWorkspaceId && !slackConnected) {
      history.replaceState(null, '', `#workspace/${deepLinkWorkspaceId}`);
      setWorkspaceId(deepLinkWorkspaceId);
      setCurrentPage('workspace-hub');
      sessionStorage.setItem('currentPage', 'workspace-hub');
      return;
    }

    const checkForSpecialRoutes = () => {
      const hash = window.location.hash.substring(1);

      if (hash === 'app-icons') { setCurrentPage('app-icons'); return; }
      if (hash === 'admin') { setCurrentPage('admin'); return; }
      if (hash === 'admin-panel') { setCurrentPage('admin-panel'); return; }
      if (hash === 'privacy') { setCurrentPage('privacy'); return; }
      if (hash === 'terms') { setCurrentPage('terms'); return; }
      if (hash === 'contact-us') { setCurrentPage('contact-us'); return; }
      if (hash === 'pricing') { setCurrentPage('pricing'); return; }
      if (hash.startsWith('payment-success')) { setCurrentPage('payment-success'); return; }
      if (hash === 'system-health') { setCurrentPage('system-health'); return; }
      if (hash === 'blog') { setCurrentPage('blog'); return; }
      if (hash.startsWith('blog/')) {
        const slug = hash.slice('blog/'.length);
        if (slug) { setBlogSlug(slug); setCurrentPage('blog-post'); }
        return;
      }

      if (hash.startsWith('assumption/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setAssumptionId(id.trim());
          setCurrentPage('assumption');
        }
        return;
      }

      // Inject noindex for private workspace / war-room routes
      if (hash.startsWith('workspace/') || hash.startsWith('workspace-settings/') || hash.startsWith('war-room/')) {
        injectNoIndex();
      }

      if (hash === 'workspaces') {
        setCurrentPage('workspaces');
        sessionStorage.setItem('currentPage', 'workspaces');
        return;
      }

      if (hash.startsWith('workspace/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setWorkspaceId(id.trim());
          setCurrentPage('workspace-hub');
          sessionStorage.setItem('currentPage', 'workspace-hub');
        }
        return;
      }

      if (hash.startsWith('workspace-settings/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setWorkspaceId(id.trim());
          setCurrentPage('workspace-settings');
          sessionStorage.setItem('currentPage', 'workspace-settings');
        }
        return;
      }

      if (hash.startsWith('join/')) {
        const token = hash.split('/')[1];
        if (token && token.trim()) {
          setJoinToken(token.trim());
          setCurrentPage('join-workspace');
        }
        return;
      }

      if (hash.startsWith('post/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setPublicPostId(id.trim());
          setPublicDiscussionId(null);
          setHighlightPostId(id.trim());
          setHighlightDiscussionId(null);
          setCurrentPage('public-post');
        }
        return;
      }

      if (hash.startsWith('agent-discussion/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setPublicDiscussionId(id.trim());
          setPublicPostId(null);
          setHighlightDiscussionId(id.trim());
          setHighlightPostId(null);
          setCurrentPage('public-post');
        }
        return;
      }

      if (hash.startsWith('profile/')) {
        const uid = hash.split('/')[1];
        if (uid && uid.trim()) {
          setSelectedUserId(uid.trim());
          setCurrentPage('profile');
          sessionStorage.setItem('selectedUserId', uid.trim());
          sessionStorage.setItem('currentPage', 'profile');
        }
        return;
      }

    };

    checkForSpecialRoutes();

    const handleHashChange = () => { checkForSpecialRoutes(); };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  useEffect(() => {
    updatePageSEO(currentPage);
    pageview(`/${currentPage}`, document.title);
  }, [currentPage]);

  useEffect(() => {
    if (user) {
      const pendingToken = sessionStorage.getItem('pendingInviteToken');
      if (pendingToken) {
        sessionStorage.removeItem('pendingInviteToken');
        sessionStorage.removeItem('postLoginRedirect');
        onboardingCheckedRef.current = true;
        setNeedsOnboarding(false);
        setJoinToken(pendingToken);
        setCurrentPage('join-workspace');
        history.replaceState(null, '', `#join/${pendingToken}`);
        return;
      }
      const redirect = sessionStorage.getItem('postLoginRedirect');
      if (redirect) {
        sessionStorage.removeItem('postLoginRedirect');
        const hashPart = redirect.split('#')[1];
        if (hashPart) window.location.hash = hashPart;
      }
      if (!onboardingCheckedRef.current) {
        checkOnboardingStatus();
      }
    } else if (!loading) {
      onboardingCheckedRef.current = false;
      setNeedsOnboarding(false);
    }
  }, [user, loading]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    try {
      const result = await Promise.race([
        supabase
          .from('profiles')
          .select('onboarded, first_name, last_name')
          .eq('id', user.id)
          .maybeSingle(),
        timeout.then(() => ({ data: null, error: new Error('timeout') }))
      ]);
      const { data, error } = result as { data: { onboarded: boolean; first_name: string | null; last_name: string | null } | null; error: Error | null };
      if (error) { onboardingCheckedRef.current = true; return; }
      const hasIncompleteName = !data?.first_name || !data?.last_name ||
                                 data.first_name.trim() === '' || data.last_name.trim() === '';
      setNeedsOnboarding(!data?.onboarded || hasIncompleteName);
      onboardingCheckedRef.current = true;
    } catch {
      onboardingCheckedRef.current = true;
    }
  };

  const handleNavigate = (page: string, idParam?: string, userId?: string, editMode?: boolean, _initialTab?: string, _threadId?: string, _initialAssumptionId?: string, postId?: string) => {
    if (page === 'public-post' && postId) {
      setPublicPostId(postId);
      setPublicDiscussionId(null);
      setHighlightPostId(postId);
      setHighlightDiscussionId(null);
      setCurrentPage('public-post');
      sessionStorage.setItem('currentPage', 'public-post');
      history.pushState(null, '', `#post/${postId}`);
      return;
    }

    if (page === 'workspace-hub' && idParam) {
      setWorkspaceId(idParam);
      setCurrentPage('workspace-hub');
      sessionStorage.setItem('currentPage', 'workspace-hub');
      history.pushState(null, '', `#workspace/${idParam}`);
      return;
    }

    if (page === 'workspace-settings' && idParam) {
      setWorkspaceId(idParam);
      setCurrentPage('workspace-settings');
      sessionStorage.setItem('currentPage', 'workspace-settings');
      history.pushState(null, '', `#workspace-settings/${idParam}`);
      return;
    }

    if (page === 'blog') {
      setCurrentPage('blog');
      history.pushState(null, '', '#blog');
      return;
    }

    if (page === 'blog-post' && idParam) {
      setBlogSlug(idParam);
      setCurrentPage('blog-post');
      history.pushState(null, '', `#blog/${idParam}`);
      return;
    }

    setCurrentPage(page);
    sessionStorage.setItem('currentPage', page);
    const hashMap: Record<string, string> = {
      home: '',
      profile: 'profile',
      pricing: 'pricing',
      workspaces: 'workspaces',
      'payment-success': 'payment-success',
    };
    if (page in hashMap) {
      const newHash = hashMap[page] || '';
      history.pushState(null, '', newHash ? `#${newHash}` : window.location.pathname + window.location.search);
    }
    sessionStorage.removeItem('selectedUserId');
  };

  const handleOnboardingComplete = () => {
    onboardingCheckedRef.current = true;
    setNeedsOnboarding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600">Loading Poddle...</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <ResetPassword onDone={clearPasswordRecovery} />
      </Suspense>
    );
  }

  if (signupEmailPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-cyan-500/30 rounded-full blur-3xl" />
        <div className="max-w-md w-full relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Poddle AI
              </h1>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-200 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(6,182,212,0.1))', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirm your email</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-1">We sent a confirmation link to</p>
            <p className="font-bold text-slate-800 text-sm mb-4">{signupEmailPending}</p>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Click the link in that email to verify your account and get started.
              Your account will not be active until the link is clicked.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-xs text-slate-500 space-y-1.5">
              <p className="font-semibold text-slate-700 text-sm mb-2">Didn't receive it?</p>
              <p>Check your spam or junk folder.</p>
              <p>Make sure <span className="font-medium text-slate-700">{signupEmailPending}</span> is correct.</p>
              <p>Confirmation emails arrive within 2 minutes.</p>
            </div>

            {resendSent && (
              <p className="text-green-600 text-sm font-medium mb-4">
                Confirmation email resent — check your inbox.
              </p>
            )}

            <button
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'rgba(37,99,235,0.3)', color: '#2563eb', background: 'rgba(37,99,235,0.04)' }}
            >
              {resending ? (
                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
            </button>

            <button
              onClick={clearSignupEmailPending}
              className="mt-3 w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Use a different email address
            </button>
          </div>
        </div>
      </div>
    );
  }

  const wrap = (node: ReactNode) => (
    <Suspense fallback={<RouteFallback />}>{node}</Suspense>
  );

  if (currentPage === 'app-icons') return wrap(<AppIcons />);
  if (currentPage === 'extension-view') return wrap(<ExtensionView />);
  if (currentPage === 'admin-panel') return wrap(<AdminPanel />);
  if (currentPage === 'privacy') return (
    <div className="flex bg-slate-50 min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      <div className="flex-1 xl:ml-60" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <Suspense fallback={<RouteFallback />}><PrivacyPolicy /></Suspense>
        <div className="xl:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  );
  if (currentPage === 'terms') return (
    <div className="flex bg-slate-50 min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      <div className="flex-1 xl:ml-60" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <Suspense fallback={<RouteFallback />}><TermsOfService /></Suspense>
        <div className="xl:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  );
  if (currentPage === 'contact-us') return (
    <div className="flex bg-slate-50 min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      <div className="flex-1 xl:ml-60" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <Suspense fallback={<RouteFallback />}><ContactUs /></Suspense>
        <div className="xl:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  );
  if (currentPage === 'pricing') return (
    <div className="flex bg-slate-50 min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      <div className="flex-1 xl:ml-60" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <Suspense fallback={<RouteFallback />}><Pricing onNavigate={handleNavigate} /></Suspense>
        <div className="xl:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  );
  if (currentPage === 'system-health') return wrap(<SystemHealth />);
  if (currentPage === 'payment-success') return wrap(<PaymentSuccess onNavigate={handleNavigate} />);

  if (currentPage === 'public-post' && (publicPostId || publicDiscussionId)) {
    return wrap(
      <PublicPost
        postId={publicPostId || undefined}
        discussionId={publicDiscussionId || undefined}
        onNavigate={(page) => {
          if (page === 'home' && user) handleNavigate('home');
          else handleNavigate(page);
        }}
      />
    );
  }

  if (currentPage === 'assumption' && assumptionId) {
    return wrap(<PublicAssumption assumptionId={assumptionId} onNavigate={handleNavigate} />);
  }

  if (currentPage === 'join-workspace' && joinToken) {
    return wrap(<JoinWorkspace token={joinToken} onNavigate={handleNavigate} />);
  }

  if (currentPage === 'blog') {
    return wrap(<Blog onNavigate={handleNavigate} />);
  }

  if (currentPage === 'blog-post' && blogSlug) {
    return wrap(<BlogPost slug={blogSlug} onNavigate={handleNavigate} />);
  }

  if (!user) {
    if (currentPage === 'auth') return <Auth />;
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
        <div style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          <GuestHome onNavigate={handleNavigate} />
        </div>
      </div>
    );
  }

  if (currentPage === 'admin') {
    return (
      <div className="flex bg-slate-50 min-h-screen">
        <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
        <div className="flex-1 xl:ml-60" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <Suspense fallback={<RouteFallback />}>
            <Admin key="admin" />
          </Suspense>
        </div>
      </div>
    );
  }

  if (needsOnboarding) return wrap(<Onboarding onComplete={handleOnboardingComplete} />);

  const activePage = currentPage === 'auth' ? 'home' : currentPage;
  const { hasBetaAccess, daysRemaining } = useBetaAccess();
  const showBetaBanner = hasBetaAccess && daysRemaining !== null && daysRemaining <= 14;
  const [betaBannerDismissed, setBetaBannerDismissed] = useState(false);

  return (
    <div className="flex" style={{ height: '100dvh', overflow: 'hidden' }}>
      <Navigation currentPage={activePage} onNavigate={handleNavigate} />
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 xl:ml-60 flex flex-col"
        style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
      >
        {showBetaBanner && !betaBannerDismissed && (
          <div className="px-4 pt-3">
            <BetaAccessBanner
              daysRemaining={daysRemaining!}
              onUpgrade={() => handleNavigate('pricing')}
              onDismiss={() => setBetaBannerDismissed(true)}
            />
          </div>
        )}
        <div className="flex-1">
          <PageErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              {activePage === 'home' && <Home key="home" onNavigate={handleNavigate} highlightPostId={highlightPostId} highlightDiscussionId={highlightDiscussionId} />}
              {activePage === 'profile' && <Profile key="profile-settings" onNavigate={handleNavigate} />}
              {activePage === 'workspaces' && <Workspaces key="workspaces" onNavigate={handleNavigate} />}
              {activePage === 'workspace-hub' && workspaceId && (
                <WorkspaceHub
                  key={`workspace-hub-${workspaceId}`}
                  workspaceId={workspaceId}
                  onBack={() => handleNavigate('workspaces')}
                  onSettings={() => handleNavigate('workspace-settings', workspaceId)}
                  onNavigate={handleNavigate}
                  onEntityClick={(_id, _type) => {}}
                />
              )}
              {activePage === 'workspace-settings' && workspaceId && (
                <WorkspaceSettings
                  key={`workspace-settings-${workspaceId}`}
                  workspaceId={workspaceId}
                  onBack={() => handleNavigate('workspace-hub', workspaceId)}
                  onNavigate={handleNavigate}
                />
              )}
              {activePage === 'privacy' && <PrivacyPolicy />}
              {activePage === 'terms' && <TermsOfService />}
              {activePage === 'pricing' && <Pricing onNavigate={handleNavigate} />}
            </Suspense>
            <div className="xl:hidden" style={{ height: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }} />
          </PageErrorBoundary>
        </div>
        <footer className="bg-white border-t border-slate-200 py-5 hidden xl:block">
          <div className="px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <span>&copy; 2026 Poddle, Inc.</span>
              <div className="flex gap-5">
                <a href="#pricing" className="hover:text-slate-600 transition-colors">Pricing</a>
                <a href="#privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
                <a href="#terms" className="hover:text-slate-600 transition-colors">Terms</a>
                <a href="#contact-us" className="hover:text-slate-600 transition-colors">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
      <InstallPrompt />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
