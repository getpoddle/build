import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, X, MapPin, LogOut, Linkedin, User, CreditCard, Loader2, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';
import { countries, getLocationsForCountry } from '../lib/locations';
import { Database } from '../lib/database.types';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import { getAvatarUrl } from '../lib/avatarUtils';
import { useBetaAccess } from '../hooks/useBetaAccess';
import InviteCodeEntry from '../components/InviteCodeEntry';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileProps {
  userId?: string | null;
  onNavigate: (page: string, podId?: string, userId?: string, gameId?: string, editMode?: boolean) => void;
  initialEditMode?: boolean;
}

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-700 text-sm bg-white transition-all";

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
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const avatarInitial = profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your profile and account preferences.</p>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          {/* Avatar row */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-5">
            {user ? (
              <ProfilePictureUpload userId={user.id} currentAvatarUrl={profile?.avatar_url || null} onUploadComplete={loadProfile} />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}>
                <span className="text-white text-xl font-black">{avatarInitial}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900">{profile?.full_name || 'Your Name'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
              {profile?.subscription_tier && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: profile.subscription_tier === 'free' ? 'rgba(15,23,42,0.06)' : 'rgba(37,99,235,0.1)', color: profile.subscription_tier === 'free' ? '#64748b' : '#2563eb' }}>
                  {profile.subscription_tier} plan
                </span>
              )}
            </div>
          </div>

          {/* Form fields */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)}
                  className={inputCls} placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Job Title</label>
                <input type="text" value={editedJobTitle} onChange={e => setEditedJobTitle(e.target.value)}
                  className={inputCls} placeholder="e.g. Product Manager" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Short Bio</label>
              <textarea value={editedBio} onChange={e => setEditedBio(e.target.value)}
                className={`${inputCls} resize-none`} rows={3} placeholder="A brief description of yourself..." />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />Country</span>
                </label>
                <select value={editedCountry} onChange={e => handleCountryChange(e.target.value)} className={inputCls}>
                  <option value="">Select country</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Region / City</label>
                {availableLocations.length > 0 ? (
                  <select value={editedLocation} onChange={e => setEditedLocation(e.target.value)} className={inputCls}>
                    <option value="">Select region</option>
                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input type="text" value={editedLocation} onChange={e => setEditedLocation(e.target.value)}
                    className={inputCls} placeholder="Enter your city" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1"><Linkedin className="w-3 h-3 text-[#0077B5]" />LinkedIn Profile URL</span>
              </label>
              <input type="url" value={editedLinkedinUrl} onChange={e => setEditedLinkedinUrl(e.target.value)}
                className={inputCls} placeholder="https://linkedin.com/in/yourname" />
            </div>
          </div>

          {/* Save bar */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between" style={{ background: 'rgba(248,250,252,0.8)' }}>
            <div className="flex items-center gap-2 text-sm">
              {saved && (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-70 hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Plans & Billing shortcut */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          <div className="px-6 py-5">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Plans &amp; Billing</h2>
            <p className="text-xs text-slate-500 mb-3">
              {profile?.subscription_tier && profile.subscription_tier !== 'free'
                ? 'Manage your subscription, update payment details, or cancel — all from the Stripe billing portal.'
                : 'Upgrade your plan or view available options.'}
            </p>
            {portalError && (
              <p className="text-xs text-red-600 mb-3">{portalError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {profile?.subscription_tier && profile.subscription_tier !== 'free' ? (
                <button
                  onClick={handleBillingPortal}
                  disabled={loadingPortal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all disabled:opacity-60"
                >
                  {loadingPortal
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ExternalLink className="w-4 h-4" />}
                  {loadingPortal ? 'Opening…' : 'Manage Subscription'}
                </button>
              ) : null}
              <button
                onClick={() => onNavigate('pricing')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                {profile?.subscription_tier && profile.subscription_tier !== 'free' ? 'View Plans' : 'Upgrade Plan'}
              </button>
            </div>
          </div>
        </div>

        {/* Beta Access */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-slate-900">Beta Access</h2>
              {hasBetaAccess && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                  <Sparkles className="w-2.5 h-2.5" /> Active
                </span>
              )}
            </div>

            {hasBetaAccess ? (
              <div>
                <p className="text-xs text-slate-500 mb-3">
                  You have active beta access.{' '}
                  {expiresAt && (
                    <>Expires {new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {daysRemaining !== null && daysRemaining <= 14 && (
                      <span className="text-amber-600 font-semibold"> ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left)</span>
                    )}.</>
                  )}
                </p>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all"
                >
                  <CreditCard className="w-4 h-4" />
                  Upgrade to a paid plan
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-3">
                  Have a beta invite code? Redeem it here for 60 days of full access.
                </p>
                <InviteCodeEntry onSuccess={refetchBeta} />
              </div>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
          <div className="px-6 py-5">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Sign Out</h2>
            <p className="text-xs text-slate-500 mb-4">You will be returned to the sign-in screen.</p>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={isSigningOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Sign Out</h3>
                <p className="text-xs text-slate-400">You'll need to sign back in</p>
              </div>
            </div>
            <p className="text-slate-600 text-sm mb-5 leading-relaxed">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-sm transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSignOut} disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                {isSigningOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
