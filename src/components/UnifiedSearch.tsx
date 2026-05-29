import { useState, useEffect } from 'react';
import { Search, User, FileText, Users, Briefcase, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import VerificationBadge from './VerificationBadge';

type SearchCategory = 'all' | 'people' | 'posts' | 'pods' | 'jobs';

interface SearchResult {
  id: string;
  type: 'profile' | 'post' | 'pod' | 'job';
  title: string;
  description: string;
  metadata?: string;
  rank?: number;
  verified?: boolean;
}

interface UnifiedSearchProps {
  onClose: () => void;
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

export default function UnifiedSearch({ onClose, onNavigate }: UnifiedSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, category]);

  const performSearch = async () => {
    if (!user) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const searchQuery = query.trim().split(' ').join(' & ');
      const results: SearchResult[] = [];

      if (category === 'all' || category === 'people') {
        // Search profiles by name and bio
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, username, bio, avatar_url, job_title, verified')
          .textSearch('search_vector', searchQuery)
          .limit(10);

        if (profiles) {
          results.push(...profiles.map(p => ({
            id: p.id,
            type: 'profile' as const,
            title: p.full_name || 'Unknown User',
            description: p.bio || 'No bio available',
            metadata: p.job_title || undefined,
            verified: p.verified
          })));
        }

        // Also search by skills
        const { data: skillMatches } = await supabase
          .from('user_skills')
          .select('user_id, skill_name, profiles!user_skills_user_id_fkey(id, full_name, bio, job_title, verified)')
          .ilike('skill_name', `%${query}%`)
          .limit(5);

        if (skillMatches) {
          skillMatches.forEach((match: any) => {
            const profile = match.profiles;
            if (profile && !results.find(r => r.id === profile.id)) {
              results.push({
                id: profile.id,
                type: 'profile' as const,
                title: profile.full_name || 'Unknown User',
                description: profile.bio || 'No bio available',
                metadata: `Skill: ${match.skill_name}`,
                verified: profile.verified
              });
            }
          });
        }

        // Also search by interests
        const { data: interestMatches } = await supabase
          .from('user_interests')
          .select('user_id, interest, profiles!user_interests_user_id_fkey(id, full_name, bio, job_title, verified)')
          .ilike('interest', `%${query}%`)
          .limit(5);

        if (interestMatches) {
          interestMatches.forEach((match: any) => {
            const profile = match.profiles;
            if (profile && !results.find(r => r.id === profile.id)) {
              results.push({
                id: profile.id,
                type: 'profile' as const,
                title: profile.full_name || 'Unknown User',
                description: profile.bio || 'No bio available',
                metadata: `Interest: ${match.interest}`,
                verified: profile.verified
              });
            }
          });
        }
      }

      if (category === 'all' || category === 'posts') {
        const raw = query.trim().replace(/[%_]/g, '\\$&');
        const pattern = `%${raw}%`;
        const { data: posts } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            agent_post_title,
            author_id,
            profiles!posts_author_id_fkey(full_name, first_name, last_name, username, avatar_url, verified)
          `)
          .or(`content.ilike.${pattern},agent_post_title.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (posts) {
          results.push(...posts.map(p => {
            const author = (p.profiles as any)?.full_name || 'Unknown';
            const title = (p as any).agent_post_title || `Post by ${author}`;
            return {
              id: p.id,
              type: 'post' as const,
              title,
              description: p.content.substring(0, 150) + (p.content.length > 150 ? '...' : ''),
              metadata: `By ${author}`,
            };
          }));
        }
      }

      if (category === 'all' || category === 'pods') {
        const { data: pods } = await supabase
          .from('pods')
          .select('id, name, description, icon, color, member_count')
          .textSearch('search_vector', searchQuery)
          .limit(10);

        if (pods) {
          results.push(...pods.map(p => ({
            id: p.id,
            type: 'pod' as const,
            title: p.name,
            description: p.description,
            metadata: `${p.member_count} members`
          })));
        }
      }

      if (category === 'all' || category === 'jobs') {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, company, location, job_type')
          .textSearch('search_vector', searchQuery)
          .eq('status', 'active')
          .limit(10);

        if (jobs) {
          results.push(...jobs.map(j => ({
            id: j.id,
            type: 'job' as const,
            title: j.title,
            description: `${j.company} • ${j.location}`,
            metadata: j.job_type
          })));
        }
      }


      setResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'profile':
        onNavigate('profile', undefined, result.id);
        break;
      case 'post':
        onNavigate('public-post', undefined, undefined, undefined, undefined, undefined, undefined, result.id);
        break;
      case 'pod':
        onNavigate('pod', result.id);
        break;
      case 'job':
        onNavigate('jobs');
        break;
    }
    onClose();
  };

  const categories = [
    { id: 'all', label: 'All', icon: Search },
    { id: 'people', label: 'People', icon: User },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'pods', label: 'Decision Rooms', icon: Users },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-white rounded-lg w-full max-w-3xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, skills, topics, templates, jobs, and more..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as SearchCategory)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    category === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No results found for "{query}"</p>
              <p className="text-sm text-gray-400 mt-1">Try different keywords</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      {result.type === 'profile' && <User className="w-5 h-5 text-white" />}
                      {result.type === 'post' && <FileText className="w-5 h-5 text-white" />}
                      {result.type === 'pod' && <Users className="w-5 h-5 text-white" />}
                      {result.type === 'job' && <Briefcase className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="font-medium text-gray-900 truncate">{result.title}</h3>
                        {result.type === 'profile' && (
                          <VerificationBadge verified={result.verified || false} size="sm" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">{result.description}</p>
                      {result.metadata && (
                        <p className="text-xs text-gray-500 mt-2">{result.metadata}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs font-medium text-gray-400 uppercase">
                        {result.type === 'pod' ? 'Decision Room' : result.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Start typing to search</p>
              <p className="text-sm text-gray-400 mt-1">
                Find people by name or skills, discover decision rooms, browse templates, and search jobs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
