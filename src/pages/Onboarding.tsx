import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Sparkles, Plus, X, MapPin, User as UserIcon } from 'lucide-react';
import { countries, getLocationsForCountry } from '../lib/locations';
import { trackProfileCompleted } from '../lib/analytics';
import { phSyncProfileProperties } from '../lib/posthog';

interface OnboardingProps {
  onComplete: () => void;
}

const DECISION_AREAS = [
  'Career moves',
  'Starting a business',
  'Investing',
  'Technology strategy',
  'Personal life choices',
  'Hiring & leadership',
  'Market opportunities',
];

const SUGGESTED_INTERESTS = [
  'Startups',
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'E-commerce',
  'AI & Automation',
  'Sustainability',
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [needsNameUpdate, setNeedsNameUpdate] = useState(false);
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [decisionAreas, setDecisionAreas] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [customInterest, setCustomInterest] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const hasIncompleteName = !data.first_name || !data.last_name ||
                                   data.first_name.trim() === '' ||
                                   data.last_name.trim() === '';

        if (hasIncompleteName) {
          setNeedsNameUpdate(true);
          setStep(0);
        } else {
          setNeedsNameUpdate(false);
          setStep(1);
        }
      }
      setIsInitialized(true);
    };

    checkProfileCompleteness();
  }, [user]);

  const toggleDecisionArea = (area: string) => {
    setDecisionAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const handleCountryChange = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setLocation('');
    const locations = getLocationsForCountry(selectedCountry);
    setAvailableLocations(locations);
  };

  const handleNameUpdate = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) return;
    setLoading(true);

    try {
      await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      }).eq('id', user.id);

      setNeedsNameUpdate(false);
      setStep(1);
    } catch (error) {
      console.error('Error updating name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    try {
      await supabase.from('profiles').update({
        onboarded: true,
        country: country || null,
        location: location || null
      }).eq('id', user.id);

      const decisionAreasData = decisionAreas.map(area => ({
        user_id: user.id,
        skill_name: area,
      }));

      if (decisionAreasData.length > 0) {
        await supabase.from('user_skills').insert(decisionAreasData);
      }

      const interestsData = interests.map(interest => ({
        user_id: user.id,
        interest_name: interest,
      }));

      if (interestsData.length > 0) {
        await supabase.from('user_interests').insert(interestsData);
      }

      trackProfileCompleted(user.id);
      phSyncProfileProperties(user.id);

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl floating"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl floating" style={{ animationDelay: '1.5s' }}></div>

      <div className="max-w-2xl w-full relative z-10">
        <div className="text-center mb-8 sm:mb-10 fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 floating">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold gradient-text">
              Welcome to Poddle
            </h1>
          </div>
          <p className="text-lg text-slate-600 leading-relaxed font-semibold">Let's personalize your experience in just a few steps</p>
        </div>

        <div className="glass-card-strong rounded-3xl shadow-2xl p-6 sm:p-10 border scale-in">
          <div className="flex gap-2 mb-10">
            {(needsNameUpdate ? [0, 1, 2, 3] : [1, 2, 3]).map(s => (
              <div
                key={s}
                className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                  s <= step ? 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-md' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {step === 0 && needsNameUpdate && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-3">
                <UserIcon className="w-7 h-7 text-blue-600" />
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Complete Your Profile
                </h2>
              </div>
              <p className="text-slate-600 mb-8 text-base leading-relaxed">Please provide your name to continue</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  />
                </div>
              </div>

              <button
                onClick={handleNameUpdate}
                disabled={!firstName.trim() || !lastName.trim() || loading}
                className="w-full mt-8 gradient-primary btn-primary py-4 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {loading ? 'Updating...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-7 h-7 text-blue-600" />
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Where are you based?
                </h2>
              </div>
              <p className="text-slate-600 mb-8 text-base leading-relaxed">Help others discover you and connect locally</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Country</label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  >
                    <option value="">Select your country</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {availableLocations.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      State / City / Region
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                    >
                      <option value="">Select your location</option>
                      {availableLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {country && availableLocations.length === 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City / Region (Optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Enter your city or region"
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!country}
                className="w-full mt-8 gradient-primary btn-primary py-4 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                What decisions do you want to get better at?
              </h2>
              <p className="text-slate-600 mb-8 text-base leading-relaxed">Select all that apply</p>

              <div className="flex flex-col gap-3 mb-8">
                {DECISION_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleDecisionArea(area)}
                    className={`flex items-center gap-3 px-5 py-4 rounded-xl font-medium text-left transition-all duration-200 border-2 ${
                      decisionAreas.includes(area)
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      decisionAreas.includes(area) ? 'border-white bg-white/30' : 'border-slate-300'
                    }`}>
                      {decisionAreas.includes(area) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                      )}
                    </span>
                    {area}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={decisionAreas.length === 0}
                  className="flex-1 gradient-primary btn-primary py-4 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                What industries interest you?
              </h2>
              <p className="text-slate-600 mb-8 text-base leading-relaxed">Choose your areas of focus</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTED_INTERESTS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      interests.includes(interest)
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomInterest()}
                  placeholder="Add custom interest..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={addCustomInterest}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {interests.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {interests.filter(i => !SUGGESTED_INTERESTS.includes(i)).map(interest => (
                    <div
                      key={interest}
                      className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg"
                    >
                      <span className="text-sm">{interest}</span>
                      <button onClick={() => setInterests(interests.filter(i => i !== interest))}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={interests.length === 0 || loading}
                  className="flex-1 gradient-primary btn-primary py-4 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                >
                  {loading ? 'Setting up your experience...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
