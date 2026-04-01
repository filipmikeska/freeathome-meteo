'use client';

import { useState, useEffect } from 'react';
import { Download, Share } from 'lucide-react';

export default function InstallLink() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const safari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    if (ios && safari) setIsIOS(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) return null;

  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
      >
        <Download className="h-3.5 w-3.5" />
        Nainstalovat aplikaci
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(!showIOSGuide)}
          className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          <Download className="h-3.5 w-3.5" />
          Nainstalovat aplikaci
        </button>
        {showIOSGuide && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Klikněte na <Share className="inline h-3.5 w-3.5 text-blue-500" /> <strong>Sdílet</strong> a poté <strong>Přidat na plochu</strong>
          </div>
        )}
      </>
    );
  }

  return null;
}
