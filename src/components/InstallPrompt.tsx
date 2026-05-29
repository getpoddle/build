import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                                (window.navigator as any).standalone === true;

    setIsIOS(isIOSDevice);
    setIsStandalone(isInStandaloneMode);

    if (isInStandaloneMode) {
      return;
    }

    const hasSeenPrompt = localStorage.getItem('pwa-prompt-dismissed');
    const lastDismissed = localStorage.getItem('pwa-prompt-dismissed-time');

    if (hasSeenPrompt && lastDismissed) {
      const daysSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    if (isIOSDevice) {
      const timeout = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timeout);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (!hasSeenPrompt) {
        const timeout = setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
      }
    } catch (error) {
      console.error('Error prompting install:', error);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    localStorage.setItem('pwa-prompt-dismissed-time', Date.now().toString());
  };

  if (!showPrompt || isStandalone) return null;

  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-50 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Download className="w-6 h-6 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">Install Poddle</h3>
            <p className="text-sm text-gray-600 mb-3">
              Add to your home screen for the best experience
            </p>

            <div className="bg-slate-50 rounded-lg p-3 mb-3 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="flex items-center gap-1">
                  <span>Tap the Share button</span>
                  <Share className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div className="flex items-center gap-1">
                  <span>Tap "Add to Home Screen"</span>
                  <Plus className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
            >
              Got it
            </button>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Download className="w-6 h-6 text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">Install Poddle</h3>
          <p className="text-sm text-gray-600 mb-3">
            Get quick access and work offline
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
