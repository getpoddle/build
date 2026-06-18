import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard as Edit2, Save, X, Briefcase, GraduationCap, Award, Plus, Trash2, MapPin, LogOut, CheckCircle, Sun, Moon, Linkedin, ExternalLink } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { countries, getLocationsForCountry } from '../lib/locations';
import { Database } from '../lib/database.types';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import FollowButton from '../components/FollowButton';
import BlockButton from '../components/BlockButton';
import UserListModal from '../components/UserListModal';
import VerificationBadge from '../components/VerificationBadge';
import { getAvatarUrl } from '../lib/avatarUtils';
import ShareButton from '../components/ShareButton';
import { setShareablePageMeta } from '../lib/seo';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Certification { name: string; issuer: string; year: string; }
interface JobExperience { company: string; title: string; start: string; end: string; description: string; }
interface Education { institution: string; degree: string; start: string; end: string; }

interface ProfileProps {
  userId?: string | null;
  onNavigate: (page: string, podId?: string, userId?: string, gameId?: string, editMode?: boolean) => void;
  initialEditMode?: boolean;
}


function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 p-5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count }: { icon?: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {Icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}>
          <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
      )}
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{label}</h2>
      {count !== undefined && count > 0 && (
        <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{count}</span>
      )}
    </div>
  );
}

export default function Profile({ userId, onNavigate, initialEditMode = false }: ProfileProps) {
  const { user, signOut } = useAuth();
  const profileUserId = userId || user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedAboutMe, setEditedAboutMe] = useState('');
  const [editedJobTitle, setEditedJobTitle] = useState('');
  const [editedCountry, setEditedCountry] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [editedCertifications, setEditedCertifications] = useState<Certification[]>([]);
  const [editedJobExperience, setEditedJobExperience] = useState<JobExperience[]>([]);
  const [editedEducation, setEditedEducation] = useState<Education[]>([]);
  const [editedLinkedinUrl, setEditedLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following'>('followers');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (profileUserId) loadAllData();
  }, [profileUserId]);

  const loadAllData = async () => {
    if (!profileUserId) return;
    try {
      const [profileRes, followersRes, followingRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', profileUserId).single(),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', profileUserId),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', profileUserId),
      ]);

      if (profileRes.data) {
        const d = profileRes.data;
        setProfile(d);

        if (profileUserId !== user?.id) {
          setShareablePageMeta({
            title: d.full_name || 'Profile',
            description: d.bio
              ? `${d.bio} — View their profile on Poddle.`
              : `${d.full_name || 'A thinker'} on Poddle — the collaborative decision intelligence platform.`,
            url: `${window.location.origin}${window.location.pathname}#profile/${profileUserId}`,
            type: 'profile',
          });
        }

        setEditedName(d.full_name || '');
        setEditedBio(d.bio || '');
        setEditedAboutMe(d.about_me || '');
        setEditedJobTitle(d.job_title || '');
        setEditedCountry(d.country || '');
        setEditedLocation(d.location || '');
        setEditedUsername(d.username || '');
        setEditedCertifications(d.certifications || []);
        setEditedJobExperience(d.job_experience || []);
        setEditedEducation(d.education || []);
        setEditedLinkedinUrl((d as any).linkedin_url || '');
        if (d.country) setAvailableLocations(getLocationsForCountry(d.country));
      }

      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (c: string) => {
    setEditedCountry(c);
    setEditedLocation('');
    setAvailableLocations(getLocationsForCountry(c));
  };

  const checkUsernameAvailability = async (u: string) => {
    if (!u || u.length < 3 || u === profile?.username) return;
    setCheckingUsername(true);
    setUsernameSuggestions([]);
    try {
      const { data, error } = await supabase.rpc('check_username_available', { p_username: u });
      if (error) throw error;
      if (!data) {
        const { data: suggestions } = await supabase.rpc('suggest_usernames', {
          p_first_name: profile?.first_name || 'user',
          p_last_name: profile?.last_name || '',
          p_desired_username: u
        });
        if (suggestions) setUsernameSuggestions(suggestions);
      }
    } catch (err) {
      console.error('Error checking username:', err);
    } finally {
      setCheckingUsername(false);
    }
  };

  const saveProfile = async () => {
    if (!user || !isOwnProfile) return;
    if (editedUsername && editedUsername !== profile?.username) {
      const { data: isAvailable } = await supabase.rpc('check_username_available', { p_username: editedUsername });
      if (!isAvailable) { alert('Username is already taken. Please choose another one.'); return; }
    }
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editedName, bio: editedBio, about_me: editedAboutMe, job_title: editedJobTitle,
        country: editedCountry || null, location: editedLocation || null, username: editedUsername || null,
        certifications: editedCertifications, job_experience: editedJobExperience, education: editedEducation,
        linkedin_url: editedLinkedinUrl.trim() || null,
        updated_at: new Date().toISOString(),
      } as any).eq('id', user.id);
      if (error) { alert(`Failed to save profile: ${error.message}`); return; }
      setIsEditing(false);
      await loadAllData();
    } catch { alert('Failed to save profile. Please try again.'); }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (!profile) return;
    setEditedName(profile.full_name || '');
    setEditedBio(profile.bio || '');
    setEditedAboutMe(profile.about_me || '');
    setEditedJobTitle(profile.job_title || '');
    setEditedCountry(profile.country || '');
    setEditedLocation(profile.location || '');
    setEditedUsername(profile.username || '');
    setEditedCertifications(profile.certifications || []);
    setEditedJobExperience(profile.job_experience || []);
    setEditedEducation(profile.education || []);
    setEditedLinkedinUrl((profile as any).linkedin_url || '');
    if (profile.country) setAvailableLocations(getLocationsForCountry(profile.country));
  };

  const isOwnProfile = user?.id === profileUserId;


  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try { await signOut(); } finally { setIsSigningOut(false); setShowLogoutConfirm(false); }
  };

  const inputCls = "w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-700 text-sm bg-white/80 touch-manipulation transition-all";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const avatarInitial = profile?.full_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <div className="max-w-2xl mx-auto">

        {/* Hero Banner */}
        <div className="relative">
          <div className="h-44 sm:h-52 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 40%, #0891b2 70%, #06b6d4 100%)' }}>
            <div className="absolute inset-0 opacity-25" style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 40%)'
            }} />
            <div className="absolute bottom-4 right-5 flex items-end gap-1.5">
              {[4,6,8,10,8,6].map((h, i) => (
                <div key={i} className="rounded-full bg-white/20" style={{ width: 5, height: h }} />
              ))}
            </div>
          </div>

          <div className="absolute left-5 sm:left-6 -bottom-14 sm:-bottom-16 z-10">
            {isOwnProfile && user ? (
              <ProfilePictureUpload userId={user.id} currentAvatarUrl={profile?.avatar_url || null} onUploadComplete={loadAllData} />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white flex-shrink-0"
                style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.2)' }}>
                {profile?.avatar_url ? (
                  <img src={getAvatarUrl(profile.avatar_url) || ''} alt={profile.full_name || 'Profile'}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}>
                    <span className="text-white text-3xl sm:text-4xl font-black">{avatarInitial}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Identity Card */}
        <div className="mx-3 sm:mx-0 rounded-b-2xl border border-slate-200/80 border-t-0 pt-20 sm:pt-24 pb-5 px-5"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 20px rgba(15,23,42,0.08)' }}>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)}
                  className="text-xl sm:text-2xl font-black text-slate-900 border-b-2 border-blue-500 outline-none bg-transparent w-full py-1 touch-manipulation"
                  placeholder="Your name" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">{profile?.full_name || 'Anonymous User'}</h1>
                  <VerificationBadge verified={profile?.verified || false} size="lg" />
                </div>
              )}

              {isEditing ? (
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                    <input type="text" value={editedUsername}
                      onChange={e => { setEditedUsername(e.target.value); setUsernameSuggestions([]); }}
                      onBlur={() => checkUsernameAvailability(editedUsername)}
                      className="w-full max-w-xs pl-7 pr-3 py-2 min-h-[40px] border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 text-sm bg-white/80 touch-manipulation"
                      placeholder="username" />
                  </div>
                  {checkingUsername && <p className="text-xs text-slate-400 mt-1">Checking...</p>}
                  {usernameSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-slate-500">Try:</span>
                      {usernameSuggestions.map(s => (
                        <button key={s} type="button" onClick={() => { setEditedUsername(s); setUsernameSuggestions([]); }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                          @{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {profile?.username && <p className="text-slate-500 text-sm">@{profile.username}</p>}
                  {profile?.job_title && (
                    <p className="text-slate-600 text-sm font-medium flex items-center gap-1.5 mt-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {profile.job_title}
                    </p>
                  )}
                  {(profile?.country || profile?.location) && (
                    <p className="text-slate-500 text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {[profile?.location, profile?.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {(profile as any)?.linkedin_url && (
                    <a
                      href={(profile as any).linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0077B5] hover:text-[#005885] transition-colors mt-0.5 group"
                    >
                      <Linkedin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>LinkedIn</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex-shrink-0">
              {isOwnProfile ? (
                isEditing ? (
                  <div className="flex gap-2">
                    <button onClick={saveProfile}
                      className="px-4 py-2 min-h-[40px] text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                      <Save className="w-4 h-4" /> Save
                    </button>
                    <button onClick={cancelEdit}
                      className="px-3 py-2 min-h-[40px] border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 active:scale-95 transition-all touch-manipulation">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setIsEditing(true)}
                      className="px-4 py-2 min-h-[40px] border border-blue-200 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 active:scale-95 transition-all flex items-center gap-1.5 text-sm font-semibold touch-manipulation">
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <ShareButton
                      url={`${window.location.origin}${window.location.pathname}#profile/${profileUserId}`}
                      title={`${profile?.full_name || 'My Profile'} on Poddle`}
                      text={`Check out ${profile?.full_name || 'my'} profile on Poddle — collaborative decision intelligence`}
                      variant="icon"
                      size="md"
                    />
                    <button onClick={() => setShowLogoutConfirm(true)} disabled={isSigningOut}
                      className="px-3 py-2 min-h-[40px] border border-red-200 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 active:scale-95 transition-all touch-manipulation disabled:opacity-50">
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )
              ) : (
                profileUserId && user && (
                  <div className="flex flex-wrap gap-2">
                    <FollowButton targetUserId={profileUserId} currentUserId={user.id} variant="default" />
                    <ShareButton
                      url={`${window.location.origin}${window.location.pathname}#profile/${profileUserId}`}
                      title={`${profile?.full_name || 'Profile'} on Poddle`}
                      text={`Check out ${profile?.full_name || 'this profile'} on Poddle`}
                      variant="icon"
                      size="md"
                    />
                    <BlockButton userId={profileUserId} />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-3">
            {isEditing ? (
              <textarea value={editedBio} onChange={e => setEditedBio(e.target.value)}
                className={`${inputCls} resize-none`} rows={3} placeholder="Tell us about yourself..." />
            ) : (
              profile?.bio && <p className="text-slate-600 text-sm leading-relaxed">{profile.bio}</p>
            )}
          </div>

          {/* Follower stats */}
          <div className="flex items-center gap-5 mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => { setModalType('followers'); setIsModalOpen(true); }}
              className="group flex items-center gap-1.5 hover:opacity-75 transition-opacity">
              <span className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">{followerCount}</span>
              <span className="text-sm text-slate-500">followers</span>
            </button>
            <button onClick={() => { setModalType('following'); setIsModalOpen(true); }}
              className="group flex items-center gap-1.5 hover:opacity-75 transition-opacity">
              <span className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">{followingCount}</span>
              <span className="text-sm text-slate-500">following</span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Edit — Professional Details */}
        {isEditing && (
          <div className="mx-3 sm:mx-0 mt-3">
            <SectionCard>
              <SectionHeader icon={Briefcase} label="Professional Details" />
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Job Title</label>
                  <input type="text" value={editedJobTitle} onChange={e => setEditedJobTitle(e.target.value)} className={inputCls} placeholder="e.g., Software Engineer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">About Me</label>
                  <textarea value={editedAboutMe} onChange={e => setEditedAboutMe(e.target.value)} className={`${inputCls} resize-none`} rows={4} placeholder="Share more about yourself..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Country</label>
                  <select value={editedCountry} onChange={e => handleCountryChange(e.target.value)} className={inputCls}>
                    <option value="">Select country</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {availableLocations.length > 0 ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Region</label>
                    <select value={editedLocation} onChange={e => setEditedLocation(e.target.value)} className={inputCls}>
                      <option value="">Select region</option>
                      {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                ) : editedCountry ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">City / Region</label>
                    <input type="text" value={editedLocation} onChange={e => setEditedLocation(e.target.value)} className={inputCls} placeholder="Enter your city" />
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">LinkedIn Profile</label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0077B5]" />
                    <input
                      type="url"
                      value={editedLinkedinUrl}
                      onChange={e => setEditedLinkedinUrl(e.target.value)}
                      className={`${inputCls} pl-9`}
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Content sections */}
        <div className="mx-3 sm:mx-0 mt-3 space-y-3">



          {/* About Me — view */}
          {profile?.about_me && !isEditing && (
            <SectionCard>
              <SectionHeader label="About Me" />
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{profile.about_me}</p>
            </SectionCard>
          )}

          {/* Work Experience — view */}
          {profile?.job_experience && profile.job_experience.length > 0 && !isEditing && (
            <SectionCard>
              <SectionHeader icon={Briefcase} label="Work Experience" />
              <div className="space-y-4">
                {profile.job_experience.map((exp: JobExperience, i: number) => (
                  <div key={i} className={`flex gap-4 ${i > 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)' }}>
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{exp.title}</h3>
                      <p className="text-blue-600 text-sm font-medium">{exp.company}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{exp.start} — {exp.end}</p>
                      {exp.description && <p className="text-slate-600 text-sm mt-2 leading-relaxed">{exp.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Work Experience — edit */}
          {isEditing && (
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={Briefcase} label="Work Experience" />
                <button onClick={() => setEditedJobExperience([...editedJobExperience, { company: '', title: '', start: '', end: '', description: '' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 active:scale-95 transition-all touch-manipulation">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3">
                {editedJobExperience.map((exp, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Position {i + 1}</span>
                      <button onClick={() => setEditedJobExperience(editedJobExperience.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all touch-manipulation">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input type="text" value={exp.title} placeholder="Job Title" className={inputCls}
                      onChange={e => { const u = [...editedJobExperience]; u[i].title = e.target.value; setEditedJobExperience(u); }} />
                    <input type="text" value={exp.company} placeholder="Company" className={inputCls}
                      onChange={e => { const u = [...editedJobExperience]; u[i].company = e.target.value; setEditedJobExperience(u); }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={exp.start} placeholder="Start" className={inputCls}
                        onChange={e => { const u = [...editedJobExperience]; u[i].start = e.target.value; setEditedJobExperience(u); }} />
                      <input type="text" value={exp.end} placeholder="End / Present" className={inputCls}
                        onChange={e => { const u = [...editedJobExperience]; u[i].end = e.target.value; setEditedJobExperience(u); }} />
                    </div>
                    <textarea value={exp.description} placeholder="Description (optional)" rows={2}
                      className={`${inputCls} resize-none`}
                      onChange={e => { const u = [...editedJobExperience]; u[i].description = e.target.value; setEditedJobExperience(u); }} />
                  </div>
                ))}
                {editedJobExperience.length === 0 && <p className="text-slate-400 text-sm text-center py-3">No work experience added yet</p>}
              </div>
            </SectionCard>
          )}

          {/* Education — view */}
          {profile?.education && profile.education.length > 0 && !isEditing && (
            <SectionCard>
              <SectionHeader icon={GraduationCap} label="Education" />
              <div className="space-y-4">
                {profile.education.map((edu: Education, i: number) => (
                  <div key={i} className={`flex gap-4 ${i > 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
                      <GraduationCap className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{edu.degree}</h3>
                      <p className="text-emerald-600 text-sm font-medium">{edu.institution}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{edu.start} — {edu.end}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Education — edit */}
          {isEditing && (
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={GraduationCap} label="Education" />
                <button onClick={() => setEditedEducation([...editedEducation, { institution: '', degree: '', start: '', end: '' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 active:scale-95 transition-all touch-manipulation">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3">
                {editedEducation.map((edu, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Education {i + 1}</span>
                      <button onClick={() => setEditedEducation(editedEducation.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all touch-manipulation">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input type="text" value={edu.degree} placeholder="Degree (e.g., BS Computer Science)" className={inputCls}
                      onChange={e => { const u = [...editedEducation]; u[i].degree = e.target.value; setEditedEducation(u); }} />
                    <input type="text" value={edu.institution} placeholder="Institution" className={inputCls}
                      onChange={e => { const u = [...editedEducation]; u[i].institution = e.target.value; setEditedEducation(u); }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={edu.start} placeholder="Start Year" className={inputCls}
                        onChange={e => { const u = [...editedEducation]; u[i].start = e.target.value; setEditedEducation(u); }} />
                      <input type="text" value={edu.end} placeholder="End Year" className={inputCls}
                        onChange={e => { const u = [...editedEducation]; u[i].end = e.target.value; setEditedEducation(u); }} />
                    </div>
                  </div>
                ))}
                {editedEducation.length === 0 && <p className="text-slate-400 text-sm text-center py-3">No education added yet</p>}
              </div>
            </SectionCard>
          )}

          {/* Certifications — view */}
          {profile?.certifications && profile.certifications.length > 0 && !isEditing && (
            <SectionCard>
              <SectionHeader icon={Award} label="Certifications" count={profile.certifications.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.certifications.map((cert: Certification, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #fefce8, #fef9c3)', border: '1px solid #fde68a' }}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <Award className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{cert.name}</h3>
                      <p className="text-amber-700 text-xs font-medium">{cert.issuer}</p>
                      {cert.year && <p className="text-slate-400 text-xs">{cert.year}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Certifications — edit */}
          {isEditing && (
            <SectionCard>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={Award} label="Certifications" />
                <button onClick={() => setEditedCertifications([...editedCertifications, { name: '', issuer: '', year: '' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 active:scale-95 transition-all touch-manipulation">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {editedCertifications.map((cert, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cert {i + 1}</span>
                      <button onClick={() => setEditedCertifications(editedCertifications.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all touch-manipulation">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input type="text" value={cert.name} placeholder="Certification Name" className={inputCls}
                      onChange={e => { const u = [...editedCertifications]; u[i].name = e.target.value; setEditedCertifications(u); }} />
                    <input type="text" value={cert.issuer} placeholder="Issuing Organization" className={inputCls}
                      onChange={e => { const u = [...editedCertifications]; u[i].issuer = e.target.value; setEditedCertifications(u); }} />
                    <input type="text" value={cert.year} placeholder="Year" className={inputCls}
                      onChange={e => { const u = [...editedCertifications]; u[i].year = e.target.value; setEditedCertifications(u); }} />
                  </div>
                ))}
                {editedCertifications.length === 0 && <p className="text-slate-400 text-sm text-center py-3 lg:col-span-2">No certifications added yet</p>}
              </div>
            </SectionCard>
          )}

        </div>
      </div>

      {isOwnProfile && (
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <SectionCard>
            <SectionHeader icon={Sun} label="Appearance" />
            <p className="text-sm text-slate-500 mb-4">Choose how Poddle looks on this device.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  theme === 'light' ? 'bg-blue-500' : 'bg-slate-200'
                }`}>
                  <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${theme === 'light' ? 'text-blue-700' : 'text-slate-700'}`}>Light</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Clean white look</p>
                </div>
                {theme === 'light' && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-slate-600 bg-zinc-900'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  theme === 'dark' ? 'bg-zinc-700' : 'bg-slate-200'
                }`}>
                  <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-500'}`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-zinc-100' : 'text-slate-700'}`}>Dark</p>
                  <p className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-400'}`}>Easy on the eyes</p>
                </div>
                {theme === 'dark' && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-100" />
                  </div>
                )}
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {profileUserId && (
        <UserListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
          userId={profileUserId} type={modalType} onUserClick={uid => onNavigate('profile', undefined, uid)} />
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 animate-scale-in" style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Sign Out</h3>
                <p className="text-xs text-slate-400">You'll need to sign back in</p>
              </div>
            </div>
            <p className="text-slate-600 text-sm mb-5 leading-relaxed">Are you sure you want to sign out of your account?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-sm transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSignOut} disabled={isSigningOut}
                className="flex-1 px-4 py-2.5 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
