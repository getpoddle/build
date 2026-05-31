import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react';
import { CheckCircle } from 'lucide-react';
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

const Profile = lazy(() => import('./pages/Profile'));
const AIFeed = lazy(() => import('./pages/AIFeed'));
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
const AgentPredictions = lazy(() => import('./pages/AgentPredictions'));
const ReasoningHub = lazy(() => import('./pages/ReasoningHub'));
const EntityDetail = lazy(() => import('./pages/EntityDetail'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const WorkspaceHub = lazy(() => import('./pages/WorkspaceHub'));
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'));
const JoinWorkspace = lazy(() => import('./pages/JoinWorkspace'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const ReasoningCategory = lazy(() => import('./pages/ReasoningCategory'));
const ReasoningEntityPage = lazy(() => import('./pages/ReasoningEntityPage'));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const { user, loading, isPasswordRecovery, clearPasswordRecovery, signupEmailPending, clearSignupEmailPending } = useAuth();
  const { toasts, dismissToast } = useToast();
  const [currentPage, setCurrentPage] = useState(() => {
    // Real-path reasoning routes take priority
    const path = window.location.pathname;
    if (path.startsWith('/reasoning/')) {
      const parts = path.split('/').filter(Boolean); // ['reasoning', cat, slug?]
      const cat = parts[1] as 'forecasts' | 'ideas' | 'problems';
      if (['forecasts', 'ideas', 'problems'].includes(cat)) {
        if (parts[2]) return 'reasoning-entity'; // entity detail pages are fine to deep-link
        return 'home'; // bare category refresh → home
      }
      return 'home';
    }
    const hash = window.location.hash.substring(1);
    if (hash === 'admin' || hash === 'admin-panel' || hash === 'app-icons') {
      return hash;
    }
    const saved = sessionStorage.getItem('currentPage');
    if (!saved || saved === 'auth') return 'home';
    // Never restore reasoning/browse pages on a bare refresh — send to home
    if (['reasoning', 'reasoning-ideas', 'reasoning-problems', 'reasoning-forecasts',
         'reasoning-hub', 'ai-feed', 'ai-insights', 'ideas-archive'].includes(saved)) {
      return 'home';
    }
    return saved;
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    const saved = sessionStorage.getItem('selectedUserId');
    return saved || null;
  });
  const [assumptionId, setAssumptionId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<'problem' | 'idea' | 'prediction' | null>(null);
  const [publicPostId, setPublicPostId] = useState<string | null>(null);
  const [publicDiscussionId, setPublicDiscussionId] = useState<string | null>(null);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [highlightDiscussionId, setHighlightDiscussionId] = useState<string | null>(null);
  const [highlightPredictionId, setHighlightPredictionId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const onboardingCheckedRef = useRef(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [reasoningSlug, setReasoningSlug] = useState<string | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return (parts[0] === 'reasoning' && parts[2]) ? parts[2] : null;
  });
  const [reasoningEntityType, setReasoningEntityType] = useState<'problem' | 'idea' | 'prediction' | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'reasoning' || !parts[2]) return null;
    const typeMap: Record<string, 'problem' | 'idea' | 'prediction'> = { forecasts: 'prediction', ideas: 'idea', problems: 'problem' };
    return typeMap[parts[1]] || null;
  });
  const [reasoningCategory, setReasoningCategory] = useState<'forecasts' | 'ideas' | 'problems' | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'reasoning') return null;
    const cat = parts[1] as 'forecasts' | 'ideas' | 'problems';
    return ['forecasts', 'ideas', 'problems'].includes(cat) ? cat : null;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('poddle_referral', refCode);
    }

    // Stripe redirects back with query params — detect payment success
    if (urlParams.get('payment_success') === '1') {
      setCurrentPage('payment-success');
      return;
    }

    const checkForSpecialRoutes = () => {
      // Real-path reasoning routes (for SEO)
      const path = window.location.pathname;
      if (path.startsWith('/reasoning/')) {
        const parts = path.split('/').filter(Boolean);
        const catSeg = parts[1] as 'forecasts' | 'ideas' | 'problems';
        const slugSeg = parts[2];
        const typeMap: Record<string, 'problem' | 'idea' | 'prediction'> = {
          forecasts: 'prediction', ideas: 'idea', problems: 'problem',
        };
        if (['forecasts', 'ideas', 'problems'].includes(catSeg)) {
          if (slugSeg?.trim() && typeMap[catSeg]) {
            setReasoningSlug(slugSeg.trim());
            setReasoningEntityType(typeMap[catSeg]);
            setReasoningCategory(catSeg);
            setCurrentPage('reasoning-entity');
            sessionStorage.setItem('currentPage', 'reasoning-entity');
          } else {
            // On a bare refresh to /reasoning/cat, reset URL to home
            // to avoid showing the reasoning category page unexpectedly
            history.replaceState(null, '', '/');
            setCurrentPage('home');
            sessionStorage.setItem('currentPage', 'home');
          }
          return;
        }
        history.replaceState(null, '', '/');
        setCurrentPage('home');
        sessionStorage.setItem('currentPage', 'home');
        return;
      }

      const hash = window.location.hash.substring(1);

      if (hash === 'app-icons') {
        setCurrentPage('app-icons');
        return;
      }

      if (hash === 'admin') {
        setCurrentPage('admin');
        return;
      }

      if (hash === 'admin-panel') {
        setCurrentPage('admin-panel');
        return;
      }

      if (hash === 'privacy') {
        setCurrentPage('privacy');
        return;
      }

      if (hash === 'terms') {
        setCurrentPage('terms');
        return;
      }

      if (hash === 'contact-us') {
        setCurrentPage('contact-us');
        return;
      }

      if (hash === 'pricing') {
        setCurrentPage('pricing');
        return;
      }

      if (hash.startsWith('payment-success')) {
        setCurrentPage('payment-success');
        return;
      }

      if (hash === 'system-health') {
        setCurrentPage('system-health');
        return;
      }

      if (hash === 'agent-predictions') {
        setHighlightPredictionId(null);
        setCurrentPage('agent-predictions');
        return;
      }

      if (hash.startsWith('prediction/')) {
        const id = hash.split('/')[1];
        if (id && id.trim()) {
          setHighlightPredictionId(id.trim());
          setCurrentPage('agent-predictions');
        }
        return;
      }

      if (hash === 'ai-insights') {
        setCurrentPage('ai-insights');
        sessionStorage.setItem('currentPage', 'ai-insights');
        history.replaceState(null, '', '#ai-feed');
        return;
      }

      if (hash === 'ideas-archive') {
        setCurrentPage('ideas-archive');
        sessionStorage.setItem('currentPage', 'ideas-archive');
        history.replaceState(null, '', '#ai-feed');
        return;
      }

      if (hash === 'ai-feed') {
        setCurrentPage('ai-feed');
        sessionStorage.setItem('currentPage', 'ai-feed');
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

      if (hash.startsWith('entity/')) {
        const parts = hash.split('/');
        const type = parts[1] as 'problem' | 'idea' | 'prediction';
        const id = parts[2];
        if (type && id && ['problem', 'idea', 'prediction'].includes(type)) {
          setEntityType(type);
          setEntityId(id.trim());
          setCurrentPage('entity-detail');
        }
        return;
      }

      if (hash === 'reasoning') {
        setCurrentPage('reasoning');
        sessionStorage.setItem('currentPage', 'reasoning');
        return;
      }

      // Legacy hash-based reasoning routes — redirect to real paths
      if (hash === 'reasoning/forecasts' || hash === 'reasoning/ideas' || hash === 'reasoning/problems') {
        const cat = hash.split('/')[1];
        history.replaceState(null, '', `/reasoning/${cat}`);
        checkForSpecialRoutes();
        return;
      }
      if (hash.startsWith('reasoning/forecasts/') || hash.startsWith('reasoning/ideas/') || hash.startsWith('reasoning/problems/')) {
        const parts = hash.split('/');
        history.replaceState(null, '', `/reasoning/${parts[1]}/${parts[2]}`);
        checkForSpecialRoutes();
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

    const handleHashChange = () => {
      checkForSpecialRoutes();
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  useEffect(() => {
    const pageName = currentPage;
    updatePageSEO(pageName);
    pageview(`/${pageName}`, document.title);
  }, [currentPage]);

  useEffect(() => {
    if (user) {
      const pendingToken = sessionStorage.getItem('pendingInviteToken');
      if (pendingToken) {
        // Clear everything and navigate directly to the join page.
        // Mark onboarding as done so it doesn't stomp the redirect.
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
        if (hashPart) {
          window.location.hash = hashPart;
        }
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

      if (error) {
        onboardingCheckedRef.current = true;
        return;
      }

      const hasIncompleteName = !data?.first_name || !data?.last_name ||
                                 data.first_name.trim() === '' ||
                                 data.last_name.trim() === '';

      setNeedsOnboarding(!data?.onboarded || hasIncompleteName);
      onboardingCheckedRef.current = true;
    } catch {
      onboardingCheckedRef.current = true;
    }
  };

  const handleNavigate = (page: string, idParam?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string, postId?: string) => {
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

    // Reasoning category index pages — use real paths for SEO
    if (page === 'reasoning-forecasts' || page === 'reasoning-ideas' || page === 'reasoning-problems') {
      const cat = page.replace('reasoning-', '') as 'forecasts' | 'ideas' | 'problems';
      setReasoningCategory(cat);
      setCurrentPage(page);
      sessionStorage.setItem('currentPage', page);
      history.pushState(null, '', `/reasoning/${cat}`);
      return;
    }

    setCurrentPage(page);
    sessionStorage.setItem('currentPage', page);
    const hashMap: Record<string, string> = {
      home: '', 'ai-feed': 'ai-feed',
      profile: userId ? `profile/${userId}` : 'profile',
      pricing: 'pricing',
      workspaces: 'workspaces',
      'payment-success': 'payment-success',
    };
    if (page in hashMap) {
      const newHash = hashMap[page] || '';
      history.pushState(null, '', newHash ? `#${newHash}` : window.location.pathname + window.location.search);
    }

    if (page === 'profile') {
      if (userId) {
        setSelectedUserId(userId);
        sessionStorage.setItem('selectedUserId', userId);
      } else {
        setSelectedUserId(null);
        sessionStorage.removeItem('selectedUserId');
      }
      setProfileEditMode(editMode || false);
    } else {
      sessionStorage.removeItem('selectedUserId');
    }
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-blue-500/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-cyan-500/30 rounded-full blur-3xl"></div>
        <div className="max-w-md w-full relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <CheckCircle className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Poddle
              </h1>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Check your email</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-2">We sent a confirmation link to</p>
            <p className="font-semibold text-slate-800 text-sm mb-5">{signupEmailPending}</p>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Click the link in the email to activate your account. If you don't see it, check your spam folder.
            </p>
            <button
              onClick={clearSignupEmailPending}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const wrap = (node: ReactNode) => (
    <Suspense fallback={<RouteFallback />}>{node}</Suspense>
  );

  if (currentPage === 'app-icons') {
    return wrap(<AppIcons />);
  }

  if (currentPage === 'admin-panel') {
    return wrap(<AdminPanel />);
  }

  if (currentPage === 'privacy') {
    return wrap(<PrivacyPolicy />);
  }

  if (currentPage === 'terms') {
    return wrap(<TermsOfService />);
  }

  if (currentPage === 'contact-us') {
    return wrap(<ContactUs />);
  }

  if (currentPage === 'pricing') {
    return wrap(<Pricing onNavigate={handleNavigate} />);
  }

  if (currentPage === 'system-health') {
    return wrap(<SystemHealth />);
  }

  if (currentPage === 'payment-success') {
    return wrap(<PaymentSuccess onNavigate={handleNavigate} />);
  }

  if (currentPage === 'agent-predictions') {
    return wrap(<AgentPredictions highlightId={highlightPredictionId} />);
  }

  if (currentPage === 'public-post' && (publicPostId || publicDiscussionId)) {
    return wrap(
      <PublicPost
        postId={publicPostId || undefined}
        discussionId={publicDiscussionId || undefined}
        onNavigate={(page) => {
          if (page === 'home' && user) {
            handleNavigate('home');
          } else {
            handleNavigate(page);
          }
        }}
      />
    );
  }

  if (currentPage === 'entity-detail' && entityId && entityType) {
    return wrap(
      <EntityDetail
        entityId={entityId}
        entityType={entityType}
        onNavigate={handleNavigate}
        onEntityClick={(id, type) => {
          setEntityId(id);
          setEntityType(type);
          window.location.hash = `entity/${type}/${id}`;
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

  if (!user) {
    if (currentPage === 'auth') {
      return <Auth />;
    }
    if (currentPage === 'profile' && selectedUserId) {
      return (
        <div className="min-h-screen bg-slate-50">
          <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
          <div style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
            <Suspense fallback={<RouteFallback />}>
              <Profile key={`profile-guest-${selectedUserId}`} userId={selectedUserId} onNavigate={handleNavigate} />
            </Suspense>
          </div>
        </div>
      );
    }
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
      <div className="min-h-screen bg-slate-50">
        <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
        <div style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          <Suspense fallback={<RouteFallback />}>
            <Admin key="admin" />
          </Suspense>
        </div>
      </div>
    );
  }


  if (needsOnboarding) {
    return wrap(<Onboarding onComplete={handleOnboardingComplete} />);
  }

  const activePage = currentPage === 'auth' ? 'home' : currentPage;

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100vh' }}
    >
      <Navigation currentPage={activePage} onNavigate={handleNavigate} />
      <main
        className="flex-1 overflow-x-hidden"
        style={{
          paddingTop: (activePage === 'reasoning' || activePage.startsWith('reasoning-'))
            ? 'calc(6.5rem + env(safe-area-inset-top, 0px))'
            : 'calc(4rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <PageErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          {activePage === 'home' && <Home key="home" onNavigate={handleNavigate} highlightPostId={highlightPostId} highlightDiscussionId={highlightDiscussionId} />}
          {activePage === 'profile' && <Profile key={`profile-${selectedUserId || 'own'}`} userId={selectedUserId} onNavigate={handleNavigate} initialEditMode={profileEditMode} />}
          {activePage === 'ai-feed' && <AIFeed key="ai-feed" onNavigate={handleNavigate} />}
          {activePage === 'ai-insights' && <AIFeed key="ai-feed-opinions" onNavigate={handleNavigate} initialTab="opinions" />}
          {activePage === 'ideas-archive' && <AIFeed key="ai-feed-ideas" onNavigate={handleNavigate} initialTab="ideas" />}
          {activePage === 'reasoning' && (
            <ReasoningHub
              key="reasoning"
              onNavigate={handleNavigate}
            />
          )}
          {(activePage === 'reasoning-forecasts' || activePage === 'reasoning-ideas' || activePage === 'reasoning-problems') && reasoningCategory && (
            <ReasoningCategory
              key={`reasoning-cat-${reasoningCategory}`}
              category={reasoningCategory}
              onNavigate={handleNavigate}
              onEntityClick={(slug, type) => {
                const cat = type === 'prediction' ? 'forecasts' : type === 'idea' ? 'ideas' : 'problems';
                setReasoningSlug(slug);
                setReasoningEntityType(type);
                setReasoningCategory(cat);
                setCurrentPage('reasoning-entity');
                sessionStorage.setItem('currentPage', 'reasoning-entity');
                history.pushState(null, '', `/reasoning/${cat}/${slug}`);
              }}
            />
          )}
          {activePage === 'reasoning-entity' && reasoningSlug && reasoningEntityType && reasoningCategory && (
            <ReasoningEntityPage
              key={`reasoning-entity-${reasoningSlug}`}
              slug={reasoningSlug}
              type={reasoningEntityType}
              onNavigate={handleNavigate}
              onEntityClick={(slug, type) => {
                const cat = type === 'prediction' ? 'forecasts' : type === 'idea' ? 'ideas' : 'problems';
                setReasoningSlug(slug);
                setReasoningEntityType(type);
                setReasoningCategory(cat);
                setCurrentPage('reasoning-entity');
                sessionStorage.setItem('currentPage', 'reasoning-entity');
                history.pushState(null, '', `/reasoning/${cat}/${slug}`);
              }}
            />
          )}
          {activePage === 'workspaces' && (
            <Workspaces key="workspaces" onNavigate={handleNavigate} />
          )}
          {activePage === 'workspace-hub' && workspaceId && (
            <WorkspaceHub
              key={`workspace-hub-${workspaceId}`}
              workspaceId={workspaceId}
              onBack={() => handleNavigate('workspaces')}
              onSettings={() => handleNavigate('workspace-settings', workspaceId)}
              onNavigate={handleNavigate}
              onEntityClick={(id, type) => {
                setEntityId(id);
                setEntityType(type);
                window.location.hash = `entity/${type}/${id}`;
              }}
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
        </PageErrorBoundary>
      </main>
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600">
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#agent-predictions" className="hover:text-blue-600 transition-colors">Predictions</a>
            <a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="#contact-us" className="hover:text-blue-600 transition-colors">Contact Us</a>
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">
            &copy; 2026 Poddle, Inc. All rights reserved.
          </p>
        </div>
      </footer>

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
