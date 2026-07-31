import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, MapPin, LogOut, Linkedin, CreditCard, Loader2, CheckCircle, ExternalLink, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { countries, getLocationsForCountry } from '../lib/locations';
import { Database } from '../lib/database.types';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import { useBetaAccess } from '../hooks/useBetaAccess';
import InviteCodeEntry from '../components/InviteCodeEntry';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileProps {
  userId?: string | null;
  onNavigate: (page: string, podId?: string, userId?: string, gameId?: string, editMode?: boolean) => void;
  initialEditMode?: boolean;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { user, signOut } = useAuth();
  const { hasBetaAccess, daysRemaining, expiresAt, refetch: refetchBeta } = useBetaAccess();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [portalError, setPortalError] = useState('');

  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedJobTitle, setEditedJobTitle] = useState('');
  const [editedCountry, setEditedCountry] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedLinkedinUrl, setEditedLinkedinUrl] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, sensitiveRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, first_name, last_name, username, avatar_url, bio, about_me, job_title, country, location, linkedin_url, education, certifications, job_experience, referral_points, referral_tier, onboarded, created_at, updated_at, verified, verification_requested_at, verified_at, theme_preference, email_notifications_enabled').eq('id', user.id).maybeSingle(),
        supabase.rpc('get_own_profile_sensitive').maybeSingle(),
      ]);
      const data = profileRes.data;
      if (data) {
        const merged = { ...data, subscription_tier: sensitiveRes.data?.subscription_tier ?? null };
        setProfile(merged as Profile);
        setEditedName(data.full_name || '');
        setEditedBio(data.bio || '');
        setEditedJobTitle(data.job_title || '');
        setEditedCountry(data.country || '');
        setEditedLocation(data.location || '');
        setEditedLinkedinUrl((data as any).linkedin_url || '');
        if (data.country) setAvailableLocations(getLocationsForCountry(data.country));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (c: string) => {
    setEditedCountry(c);
    setEditedLocation('');
    setAvailableLocations(getLocationsForCountry(c));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editedName,
        bio: editedBio,
        job_title: editedJobTitle,
        country: editedCountry || null,
        location: editedLocation || null,
        linkedin_url: editedLinkedinUrl.trim() || null,
        updated_at: new Date().toISOString(),
      } as any).eq('id', user.id);
      if (!error) {
        setSaved(true);
        await loadProfile();
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try { await signOut(); } finally { setIsSigningOut(false); setShowLogoutConfirm(false); }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleteError('No active session. Please sign in again.');
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/request-account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        setDeleteError(json.error || 'Failed to schedule account deletion. Please try again.');
        return;
      }
      setShowDeleteConfirm(false);
      await signOut();
    } catch {
      setDeleteError('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBillingPortal = async () => {
    if (!user) return;
    setLoadingPortal(true);
    setPortalError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-billing-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setPortalError('No billing account found. Go to Workspace Settings to manage billing.');
      }
    } catch {
      setPortalError('Something went wrong. Please try again.');
    } finally {
      setLoadingPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-10 h-10 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const avatarInitial = profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>

        {/* Header */}
        <div>
          <p className="section-label mb-2">Account</p>
          <h1 className="display-heading text-xl sm:text-2xl">Account Settings</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--app-text-secondary)' }}>Manage your profile and account preferences.</p>
        </div>

        {/* Profile card */}
        <div className="panel overflow-hidden">
          {/* Avatar row */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-4 sm:gap-5" style={{ borderBottom: '1px solid var(--app-border)' }}>
            {user ? (
              <ProfilePictureUpload userId={user.id} currentAvatarUrl={profile?.avatar_url || null} onUploadComplete={loadProfile} />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)' }}>
                <span className="text-xl font-bold" style={{ color: 'var(--signal)' }}>{avatarInitial}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>{profile?.full_name || 'Your Name'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>{user?.email}</p>
              {profile?.subscription_tier && (
                <span className="badge badge-amber capitalize mt-1.5">
                  {profile.subscription_tier} plan
                </span>
              )}
            </div>
          </div>

          {/* Form fields */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block section-label mb-1.5">Full Name</label>
                <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)}
                  className="input-modern" placeholder="Your full name" />
              </div>
              <div>
                <label className="block section-label mb-1.5">Job Title</label>
                <input type="text" value={editedJobTitle} onChange={e => setEditedJobTitle(e.target.value)}
                  className="input-modern" placeholder="e.g. Product Manager" />
              </div>
            </div>

            <div>
              <label className="block section-label mb-1.5">Short Bio</label>
              <textarea value={editedBio} onChange={e => setEditedBio(e.target.value)}
                className="input-modern" rows={3} placeholder="A brief description of yourself..." />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block section-label mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />Country</span>
                </label>
                <select value={editedCountry} onChange={e => handleCountryChange(e.target.value)} className="input-modern">
                  <option value="">Select country</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block section-label mb-1.5">Region / City</label>
                {availableLocations.length > 0 ? (
                  <select value={editedLocation} onChange={e => setEditedLocation(e.target.value)} className="input-modern">
                    <option value="">Select region</option>
                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input type="text" value={editedLocation} onChange={e => setEditedLocation(e.target.value)}
                    className="input-modern" placeholder="Enter your city" />
                )}
              </div>
            </div>

            <div>
              <label className="block section-label mb-1.5">
                <span className="inline-flex items-center gap-1"><Linkedin className="w-3 h-3" style={{ color: 'var(--agent-fin)' }} />LinkedIn Profile URL</span>
              </label>
              <input type="url" value={editedLinkedinUrl} onChange={e => setEditedLinkedinUrl(e.target.value)}
                className="input-modern" placeholder="https://linkedin.com/in/yourname" />
            </div>
          </div>

          {/* Save bar */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-raised)' }}>
            <div className="flex items-center gap-2 text-sm">
              {saved && (
                <span className="flex items-center gap-1.5 font-medium text-positive">
                  <CheckCircle className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Plans & Billing shortcut */}
        <div className="panel p-4 sm:p-6">
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Plans &amp; Billing</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--app-text-secondary)' }}>
            {profile?.subscription_tier && profile.subscription_tier !== 'free'
              ? 'Manage your subscription, update payment details, or cancel — all from the Stripe billing portal.'
              : 'Upgrade your plan or view available options.'}
          </p>
          {portalError && (
            <p className="text-xs mb-3" style={{ color: 'var(--negative)' }}>{portalError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {profile?.subscription_tier && profile.subscription_tier !== 'free' ? (
              <button onClick={handleBillingPortal} disabled={loadingPortal} className="btn-secondary">
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {loadingPortal ? 'Opening…' : 'Manage Subscription'}
              </button>
            ) : null}
            <button onClick={() => onNavigate('pricing')} className="btn-secondary">
              <CreditCard className="w-4 h-4" />
              {profile?.subscription_tier && profile.subscription_tier !== 'free' ? 'View Plans' : 'Upgrade Plan'}
            </button>
          </div>
        </div>

        {/* Beta Access */}
        <div className="panel p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Beta Access</h2>
            {hasBetaAccess && (
              <span className="badge badge-amber">
                <Sparkles className="w-2.5 h-2.5" /> Active
              </span>
            )}
          </div>

          {hasBetaAccess ? (
            <div>
              <p className="text-xs mb-3" style={{ color: 'var(--app-text-secondary)' }}>
                You have active beta access.{' '}
                {expiresAt && (
                  <>Expires {new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {daysRemaining !== null && daysRemaining <= 14 && (
                    <span className="font-semibold text-caution"> ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left)</span>
                  )}.</>
                )}
              </p>
              <button onClick={() => onNavigate('pricing')} className="btn-secondary">
                <CreditCard className="w-4 h-4" />
                Upgrade to a paid plan
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: 'var(--app-text-secondary)' }}>
                Have a beta invite code? Redeem it here for 60 days of full access.
              </p>
              <InviteCodeEntry onSuccess={refetchBeta} />
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="panel p-4 sm:p-6">
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Sign Out</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--app-text-secondary)' }}>You will be returned to the sign-in screen.</p>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={isSigningOut}
            className="btn-secondary"
            style={{ borderColor: 'var(--negative)', color: 'var(--negative)' }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="panel-raised max-w-sm w-full p-6" style={{ boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 flex items-center justify-center" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
                <LogOut className="w-5 h-5" style={{ color: 'var(--negative)' }} />
              </div>
              <div>
                <h3 className="display-heading text-lg">Sign Out</h3>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>You'll need to sign back in</p>
              </div>
            </div>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} disabled={isSigningOut} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="btn-primary flex-1"
                style={{ background: 'var(--negative)', borderColor: 'var(--negative)', color: 'var(--ink-900)' }}
              >
                {isSigningOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account section */}
      <div className="panel-base p-5 mt-6" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: '#dc2626' }}>Delete Account</h2>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
          Permanently delete your account and all associated data. Your account will be deactivated
          immediately and permanently deleted after a 7-day grace period. If you sign in during that
          window, you can restore your account.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="max-w-md w-full panel-raised p-6" style={{ boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 className="display-heading text-lg mb-1">Delete Account</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
                  Are you sure? Your account and data will be permanently deleted after 7 days.
                  You'll be signed out immediately. If you change your mind, sign back in within
                  7 days to restore your account.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-4 p-3 text-sm rounded-lg" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                disabled={deleting}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: '#dc2626', color: 'white' }}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Processing…' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
