import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit3, Trash2, Eye, EyeOff, Star, StarOff, ExternalLink, Save, X, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  external_url: string | null;
  category: string;
  author_name: string;
  author_avatar_url: string | null;
  reading_time_minutes: number;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
}

const CATEGORIES = [
  { id: 'product-update', label: 'Product Update' },
  { id: 'company',        label: 'Company' },
  { id: 'feature',        label: 'Feature' },
  { id: 'use-case',       label: 'Use Case' },
  { id: 'about',          label: 'About Us' },
];

const EMPTY_FORM = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_image_url: '',
  external_url: '',
  category: 'company',
  author_name: 'Poddle Team',
  author_avatar_url: '',
  reading_time_minutes: 3,
  is_published: false,
  is_featured: false,
};

type FormData = typeof EMPTY_FORM;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find(c => c.id === category);
  const colors: Record<string, { bg: string; text: string }> = {
    'product-update': { bg: 'rgba(37,99,235,0.1)',   text: '#1d4ed8' },
    'company':        { bg: 'rgba(15,23,42,0.06)',   text: '#475569' },
    'feature':        { bg: 'rgba(22,163,74,0.1)',   text: '#15803d' },
    'use-case':       { bg: 'rgba(245,158,11,0.1)',  text: '#b45309' },
    'about':          { bg: 'rgba(124,58,237,0.1)',  text: '#7c3aed' },
  };
  const c = colors[category] || colors['company'];
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
      {cat?.label ?? category}
    </span>
  );
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setSlugManual(false);
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function openEdit(post: BlogPostRow) {
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url || '',
      external_url: post.external_url || '',
      category: post.category,
      author_name: post.author_name,
      author_avatar_url: post.author_avatar_url || '',
      reading_time_minutes: post.reading_time_minutes,
      is_published: post.is_published,
      is_featured: post.is_featured,
    });
    setSlugManual(true);
    setEditing(post);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  function handleTitleChange(val: string) {
    setForm(f => ({ ...f, title: val, slug: slugManual ? f.slug : slugify(val) }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.slug.trim() || !form.excerpt.trim()) {
      setError('Title, slug, and excerpt are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content,
      cover_image_url: form.cover_image_url.trim() || null,
      external_url: form.external_url.trim() || null,
      category: form.category,
      author_name: form.author_name.trim() || 'Poddle Team',
      author_avatar_url: form.author_avatar_url.trim() || null,
      reading_time_minutes: Math.max(1, form.reading_time_minutes),
      is_published: form.is_published,
      is_featured: form.is_featured,
      published_at: form.is_published ? (editing?.published_at || new Date().toISOString()) : null,
    };

    if (editing) {
      const { data: updated, error: err } = await supabase
        .from('blog_posts')
        .update(payload)
        .eq('id', editing.id)
        .select('id');
      if (err) { setError(err.message); setSaving(false); return; }
      if (!updated || updated.length === 0) {
        setError('Update was blocked — your session may not have admin permission. Try signing out and back in to the admin panel.');
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from('blog_posts').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    closeForm();
    loadPosts();
  }

  async function togglePublished(post: BlogPostRow) {
    const newVal = !post.is_published;
    await supabase.from('blog_posts').update({
      is_published: newVal,
      published_at: newVal ? (post.published_at || new Date().toISOString()) : null,
    }).eq('id', post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_published: newVal, published_at: newVal ? (p.published_at || new Date().toISOString()) : null } : p));
  }

  async function toggleFeatured(post: BlogPostRow) {
    const newVal = !post.is_featured;
    // Only one featured post at a time
    if (newVal) {
      await supabase.from('blog_posts').update({ is_featured: false }).neq('id', post.id);
    }
    await supabase.from('blog_posts').update({ is_featured: newVal }).eq('id', post.id);
    setPosts(prev => prev.map(p => ({
      ...p,
      is_featured: p.id === post.id ? newVal : (newVal ? false : p.is_featured),
    })));
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await supabase.from('blog_posts').delete().eq('id', deleteConfirm);
    setPosts(prev => prev.filter(p => p.id !== deleteConfirm));
    setDeleteConfirm(null);
    setDeleting(false);
  }

  if (creating || editing) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-900">{editing ? 'Edit Post' : 'New Post'}</h2>
          <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Your post title"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Slug * <span className="font-normal text-slate-400">(URL-safe)</span></label>
            <input
              value={form.slug}
              onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }}
              placeholder="my-post-slug"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Excerpt * <span className="font-normal text-slate-400">(1-2 sentences)</span></label>
            <textarea
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              rows={2}
              placeholder="Brief description shown on the blog index"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          {/* Category + Author row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Read time (minutes)</label>
              <input
                type="number" min={1} max={60}
                value={form.reading_time_minutes}
                onChange={e => setForm(f => ({ ...f, reading_time_minutes: Number(e.target.value) }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Author + avatar */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Author name</label>
              <input
                value={form.author_name}
                onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Author avatar URL</label>
              <input
                value={form.author_avatar_url}
                onChange={e => setForm(f => ({ ...f, author_avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Cover image URL</label>
            <input
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://images.pexels.com/..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="Preview" className="mt-2 h-24 rounded-lg object-cover" />
            )}
          </div>

          {/* External link */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              External link URL <span className="font-normal text-slate-400">(optional — clicking the post will open this URL instead of the post page)</span>
            </label>
            <input
              value={form.external_url}
              onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Content <span className="font-normal text-slate-400">(HTML — use &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt;, etc.)</span>
            </label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={16}
              placeholder="<h2>Introduction</h2><p>Your article content here...</p>"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                className="relative w-10 h-5.5 rounded-full transition-colors cursor-pointer"
                style={{ background: form.is_published ? '#16a34a' : '#e2e8f0', width: '40px', height: '22px' }}
              >
                <div className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform"
                  style={{ width: '18px', height: '18px', transform: form.is_published ? 'translateX(18px)' : 'translateX(0)' }} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, is_featured: !f.is_featured }))}
                className="relative rounded-full transition-colors cursor-pointer"
                style={{ background: form.is_featured ? '#2563eb' : '#e2e8f0', width: '40px', height: '22px' }}
              >
                <div className="absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform"
                  style={{ width: '18px', height: '18px', transform: form.is_featured ? 'translateX(18px)' : 'translateX(0)' }} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Featured (hero)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create post'}
            </button>
            <button onClick={closeForm} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">Blog Posts</h2>
          <p className="text-sm text-slate-500 mt-0.5">{posts.length} total · {posts.filter(p => p.is_published).length} published</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
        >
          <Plus className="w-4 h-4" /> New post
        </button>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="mb-5 flex items-center gap-4 p-4 rounded-xl border border-red-100 bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-semibold flex-1">Delete this post permanently?</p>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-semibold mb-2">No posts yet</p>
          <p className="text-sm">Create your first blog post to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id}
              className="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all group">
              {/* Cover thumb */}
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt="" className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-10 rounded-lg bg-slate-100 flex-shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <CategoryBadge category={post.category} />
                  {post.is_featured && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Featured</span>
                  )}
                  {!post.is_published && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Draft</span>
                  )}
                  {post.external_url && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />External link
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">{post.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />{post.reading_time_minutes} min
                  </span>
                  {post.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{formatDate(post.published_at)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />{post.view_count} views
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={`https://blog.poddleme.com/#blog-post/${post.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  title="Preview"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => toggleFeatured(post)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title={post.is_featured ? 'Unfeature' : 'Set as featured'}
                  style={{ color: post.is_featured ? '#2563eb' : '#94a3b8' }}
                >
                  {post.is_featured ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => togglePublished(post)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title={post.is_published ? 'Unpublish' : 'Publish'}
                  style={{ color: post.is_published ? '#16a34a' : '#94a3b8' }}
                >
                  {post.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openEdit(post)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(post.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
