import { useState, useRef, useEffect } from 'react';
import { Share2, Link2, Twitter, Linkedin, Facebook, Check, MessageCircle, X } from 'lucide-react';

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  variant?: 'icon' | 'pill' | 'full';
  size?: 'sm' | 'md';
  className?: string;
  onShare?: () => void;
}

export default function ShareButton({ url, title, text, variant = 'pill', size = 'md', className = '', onShare }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;

  const shareText = text || title;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: absoluteUrl });
        onShare?.();
        setMenuOpen(false);
      } catch {
        // user cancelled — no-op
      }
    } else {
      setMenuOpen(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      onShare?.();
      setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 1800);
    } catch {
      const el = document.createElement('textarea');
      el.value = absoluteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => { setCopied(false); setMenuOpen(false); }, 1800);
    }
  };

  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedText = encodeURIComponent(shareText);

  const socialLinks = [
    {
      label: 'X (Twitter)',
      icon: <Twitter className="w-4 h-4" />,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      color: 'hover:bg-slate-100 text-slate-700',
    },
    {
      label: 'LinkedIn',
      icon: <Linkedin className="w-4 h-4" />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-blue-50 text-[#0077B5]',
    },
    {
      label: 'Facebook',
      icon: <Facebook className="w-4 h-4" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-50 text-[#1877F2]',
    },
    {
      label: 'WhatsApp',
      icon: <MessageCircle className="w-4 h-4" />,
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      color: 'hover:bg-green-50 text-[#25D366]',
    },
  ];

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnBase = size === 'sm'
    ? 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all touch-manipulation'
    : 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all touch-manipulation';

  return (
    <div className={`relative inline-flex ${className}`} ref={menuRef}>
      <button
        onClick={handleNativeShare}
        className={`${btnBase} bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95`}
        title="Share"
      >
        {copied ? <Check className={`${iconSize} text-emerald-500`} /> : <Share2 className={iconSize} />}
        {variant !== 'icon' && <span>{copied ? 'Copied!' : 'Share'}</span>}
      </button>

      {menuOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-fade-in"
          style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.15)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Share</span>
            <button onClick={() => setMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Link2 className="w-4 h-4 text-slate-500 flex-shrink-0" />}
              {copied ? 'Link copied!' : 'Copy link'}
            </button>
            {socialLinks.map(({ label, icon, href, color }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { onShare?.(); setMenuOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${color}`}
              >
                {icon}
                {label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
