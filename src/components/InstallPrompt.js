'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check if already dismissed
    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Android/Chrome — capture install event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS — detect Safari on iPhone/iPad
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem('pwa-dismissed', '1');
  };

  // Nothing to show
  if (dismissed || (!deferredPrompt && !showIOSPrompt)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white text-sm">
            Nainstalovat aplikaci
          </div>
          {deferredPrompt ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Přidejte si Meteostanici na plochu pro rychlý přístup.
              </p>
              <button
                onClick={handleInstall}
                className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Nainstalovat
              </button>
            </>
          ) : showIOSPrompt ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Klikněte na{' '}
              <Share className="inline h-3.5 w-3.5 text-blue-500" />{' '}
              <strong>Sdílet</strong> a poté{' '}
              <strong>Přidat na plochu</strong>.
            </p>
          ) : null}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Zavřít"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
